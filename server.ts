import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "http";
import {
  acceptMessageRequest,
  addConnection,
  addMessage,
  clearChat,
  connectionsData,
  deleteChat,
  deleteMessage,
  getChat,
  getConnectionData,
  getMessages,
  getProfileById,
  isUserRestricted,
  mongoDbClient,
  provideSignedURL,
  updateMessage,
  updateSeenMessages,
  updateStatus,
  updateUnseenMsgCount,
} from "./MongoDB_Helper";
import { signupTokenAuthority, tokenAuthority } from "./API/middleware";
import route from "./Router";
import { existsSync } from "fs";
import path from "path";
// import mongoose from "mongoose";
import { availableParallelism, platform } from "os";
import cluster from "cluster";
import { setupMaster, setupWorker } from "@socket.io/sticky";
import { setupPrimary, createAdapter } from "@socket.io/cluster-adapter";
import process from "process";
import { validateToken } from "./utils/jwt";
import { SOCKET_HANDLERS, USER_STATUS } from "./utils/enums";
import { MessageUpdate } from "./@types/index";
import { getRData } from "./Redis_Helper/index";

const corsPolicy: cors.CorsOptions | cors.CorsOptionsDelegate | undefined = {
  origin: process.env.Client_URL?.includes(",") ? process.env.Client_URL.split(",") : process.env.Client_URL,
  credentials: true,
};

try {
  if (!(process.env.DB_UserName || process.env.DB_PassWord)) throw new Error("DB_UserName or DB_PassWord is not defined");
  if (cluster.isPrimary) {
    const allCores = availableParallelism();
    const availableCores = process.env.WORKER_LIMIT !== undefined ? Number(process.env.WORKER_LIMIT) : allCores;
    console.log("Platform: %s", platform());
    console.log("Primary process...");
    console.log("Starting %d workers out of %d available cores", availableCores, allCores);
    const PORT = process.env.PORT || 5000;
    const httpServer = createServer();
    setupMaster(httpServer, {
      loadBalancingMethod: "least-connection",
    });
    setupPrimary();
    cluster.setupPrimary({ serialization: "advanced" });
    if (availableCores > 1) {
      console.log("Creating clusters");
      for (let i = 0; i < availableCores; i++) {
        cluster.fork();
      }
    }
    let currentOnline = 0;
    cluster.on("online", (worker) => {
      console.log(`Online: ${worker.process.pid}`);
      currentOnline++;
      if (currentOnline === availableCores) {
        httpServer.listen(PORT, () => {
          console.log("Server started at", PORT);
        });
      }
    });
    cluster.on("exit", (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died.`);
      console.log(`Current Online: ${Object.keys(cluster.workers as object).length}`);
    });
  } else {
    const expressApp = express();

    const server = createServer(expressApp);
    const io = new Server(server, {
      cors: corsPolicy,
    });
    io.adapter(createAdapter());
    setupWorker(io);
    // Socket
    io.on("connection", async (socket) => {
      // socket.onAny((event, ...rest) => {
      //   console.log("Socket Rooms:", socket.rooms, "\nevent:", event, "\nrest:", rest);
      // });
      //TODO: Optimize Authorization if possible
      const authToken = socket.handshake.headers.authorization?.split(" ")[1] || "";
      let loggedInUserId = "";
      try {
        if (authToken.length < 10) {
          throw new Error("Invalid Auth Token");
        }
        const data = await validateToken(authToken, "login");
        if (data) {
          loggedInUserId = data.id;
        }
      } catch (e) {
        if (e) {
          socket.disconnect(true);
          return;
        }
      }

      const { chatIds, chats, connections, hasData } = await connectionsData(loggedInUserId);
      socket.emit(SOCKET_HANDLERS.CONNECTION.ConnectionData, {
        hasData,
        chats,
        connections,
      });
      if (chatIds.length > 0) {
        socket.join(chatIds);
      }
      socket.join(`${loggedInUserId}-req`); //New Request Room

      socket.on(SOCKET_HANDLERS.CONNECTION.StatusUpdate, (userId, { code, update_type }) => {
        if (!code || !update_type) return;
        if (socket.rooms.size > 2) {
          const roomIds = new Set(socket.rooms);
          roomIds.delete(`${loggedInUserId}-req`);
          socket.to([...roomIds]).emit(SOCKET_HANDLERS.CONNECTION.StatusUpdate, userId, {
            code,
            lastActive: code === USER_STATUS.OFFLINE ? new Date().toISOString() : "",
          });
        }
        updateStatus(userId, { code, update_type });
      });

      socket.on(SOCKET_HANDLERS.CHAT.AttachmentURL, async (chat_id: string, fileInfo: { name: string; size: number }[]) => {
        if (chat_id && fileInfo.length > 0) {
          const data = await provideSignedURL(chat_id, fileInfo);
          socket.emit(SOCKET_HANDLERS.CHAT.AttachmentURL, data);
        }
      });
      socket.on(SOCKET_HANDLERS.CHAT.NewRequest, async ({ receiverId, messageObject }) => {
        const isBlocked = await isUserRestricted(loggedInUserId, receiverId);
        if (isBlocked) {
          socket.emit(SOCKET_HANDLERS.CHAT.NewRequest_Failed, "You can no longer message this contact");
          return;
        }
        delete messageObject.tempId;

        const { chat_id } = await addConnection(loggedInUserId, receiverId, messageObject);
        socket.join(chat_id.toString());
        if (chat_id) {
          const [chats, [profile1, profile2], senderConnectionData, receiverConnectionData] = await Promise.all(
            [
              getChat([chat_id]),
              getProfileById([loggedInUserId, receiverId]),
              getConnectionData(loggedInUserId, receiverId),
              getConnectionData(receiverId, loggedInUserId),
            ].filter(Boolean),
          );

          socket.emit(SOCKET_HANDLERS.CHAT.NewRequest_Success, {
            chat: chats[0],
            connectionProfile: {
              ...(profile1.id.toString() === loggedInUserId ? profile2 : profile1),
              ...senderConnectionData,
            },
          });
          socket.to(`${receiverId}-req`).emit(SOCKET_HANDLERS.CHAT.NewRequest_Success, {
            chat: chats[0],
            connectionProfile: {
              ...(profile1.id.toString() !== loggedInUserId ? profile2 : profile1),
              ...receiverConnectionData,
            },
          });
        }
      });

      socket.on(SOCKET_HANDLERS.CHAT.NewRequest_Accepted, async (chatId, fromId) => {
        await acceptMessageRequest(chatId, fromId);
        socket.to(chatId).emit(SOCKET_HANDLERS.CHAT.NewRequest_Accepted, chatId, fromId);
      });

      socket.on(SOCKET_HANDLERS.CHAT.JoinRoom, (chatId) => {
        socket.join(chatId);
      });

      socket.on(SOCKET_HANDLERS.CHAT.LeaveRoom, (chat_id) => {
        socket.leave(chat_id);
      });

      socket.on(SOCKET_HANDLERS.CHAT.TypingUpdate, (chat_id, author) => {
        if (chat_id && author) {
          socket.to(chat_id).emit(SOCKET_HANDLERS.CHAT.TypingUpdate, chat_id, author);
          /*
           * // TODO: It should be a throttling update from client.
           * Because if the user is just logged in and one of it's connections was typing then it won't be send to the logged in user. Because typing update was sent before they were logged in
           */
          // if (author.isTyping) {
          //   chatsCollection.updateOne(
          //     { _id: new ObjectId(chat_id) },
          //     { $addToSet: { authors_typing: new ObjectId(author.authorId) } }
          //   );
          // } else {
          //   chatsCollection.updateOne(
          //     { _id: new ObjectId(chat_id) },
          //     { $pull: { authors_typing: new ObjectId(author.authorId) } }
          //   );
          // }
        }
      });
      //TODO: Implement lazy load messages
      socket.on(SOCKET_HANDLERS.CHAT.LoadMore, async (chatId, { size = 50, offset = 0 }) => {
        const data = await getMessages(chatId, offset, size);
        socket.emit(SOCKET_HANDLERS.CHAT.MoreMessages, chatId, data);
      });
      socket.on(SOCKET_HANDLERS.CHAT.NewMessage, async ({ chat_id, receiverId, messageObject }) => {
        const currentTime = new Date();
        messageObject.timestamp = currentTime;
        messageObject.seenByRecipients = [];
        try {
          const messageTempId = messageObject.tempId;
          delete messageObject.tempId;
          const data = await Promise.all([addMessage(chat_id, messageObject), updateUnseenMsgCount(messageObject.sender_id, receiverId)]);
          io.to(chat_id).emit(SOCKET_HANDLERS.CHAT.NewMessage, chat_id, currentTime, { ...messageObject, id: data[0], tempId: messageTempId });
        } catch (e) {
          console.log("MessageTransferFailed:", e);
          socket.emit(SOCKET_HANDLERS.CHAT.NewMessage_Failed, chat_id);
        }
      });

      socket.on(
        SOCKET_HANDLERS.CHAT.MESSAGE.Delete,
        async (
          { chatId, messageId, fromId, attachments }: { chatId: string; messageId: string; fromId: string; attachments: string[] },
          forAll = false,
        ) => {
          await deleteMessage(chatId, messageId, fromId, forAll, attachments); //assetKey for attachment message
          if (forAll) {
            io.to(chatId).emit(SOCKET_HANDLERS.CHAT.MESSAGE.Delete, chatId, messageId);
            console.log("SocketMsgSend", { chatId, messageId });
          }
        },
      );

      socket.on(SOCKET_HANDLERS.CHAT.MESSAGE.Edit, async (chat_id: string, messageId: string, update: MessageUpdate, fromId: string) => {
        await updateMessage(chat_id, messageId, update, fromId);
        io.to(chat_id).emit(SOCKET_HANDLERS.CHAT.MESSAGE.Edit, chat_id, messageId, update);
      });

      socket.on(SOCKET_HANDLERS.CHAT.SeenUpdate, async (chat_id: string, seenByUserId: string, toReceiverId: string, messageId: string) => {
        const data = await Promise.all([
          updateSeenMessages(chat_id, seenByUserId, messageId),
          updateUnseenMsgCount(toReceiverId, seenByUserId, false),
        ]);
        socket.to(chat_id).emit(SOCKET_HANDLERS.CHAT.SeenUpdate, chat_id, seenByUserId, messageId);
      });

      socket.on(SOCKET_HANDLERS.CHAT.ClearAll, async ({ chatId, fromId, toId }) => {
        await clearChat(chatId, fromId, toId);
        socket.to(chatId).emit(SOCKET_HANDLERS.CHAT.ClearAll, chatId, fromId);
      });

      socket.on(SOCKET_HANDLERS.CONNECTION.RemoveConnection, async (chatId, { fromUserId, toUserId, toBlock }) => {
        await deleteChat(chatId, fromUserId, toUserId, toBlock);
        socket.to(chatId).emit(SOCKET_HANDLERS.CONNECTION.RemoveConnection, fromUserId, chatId);
        socket.leave(chatId);
      });

      // RTC Signaling Handlers

      socket.on(SOCKET_HANDLERS.RTC_SIGNALING.Offer, (chatId: string, desc) => {
        socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.Offer, desc);
      });
      socket.on(SOCKET_HANDLERS.RTC_SIGNALING.Answer, (chatId: string, msg: object) => {
        socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.Answer, msg);
      });
      socket.on(SOCKET_HANDLERS.RTC_SIGNALING.Candidate, (chatId: string, msg: object) => {
        socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.Candidate, msg);
      });
      socket.on(SOCKET_HANDLERS.RTC_SIGNALING.End, (chatId: string) => {
        socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.End);
      });
      socket.on(SOCKET_HANDLERS.RTC_SIGNALING.Reconnect, (chatId: string) => {
        socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.Reconnect);
      });
      socket.on(SOCKET_HANDLERS.RTC_SIGNALING.Reconnect_RESP, (chatId: string, userId: string) => {
        socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.Reconnect_RESP, userId);
      });
      socket.on(SOCKET_HANDLERS.RTC_SIGNALING.CallInitiator, (chatId: string, ...args) => {
        socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.CallInitiator, chatId, ...args);
      });
      socket.on(SOCKET_HANDLERS.RTC_SIGNALING.CallInitiator_RESP, (chatId: string, responseFromUserId: string) => {
        socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.CallInitiator_RESP, responseFromUserId);
      });

      socket.on("disconnect", async (reason) => {
        const rData = await getRData(socket.handshake.headers.authorization?.split(" ")[1] || "");
        if (rData) {
          const parsedD = await JSON.parse(rData);
          socket
            .to(socket.rooms as any)
            .emit(SOCKET_HANDLERS.CONNECTION.StatusUpdate, (parsedD.id, { status: USER_STATUS.OFFLINE, last_active: new Date() }, reason));
          updateStatus(parsedD.id, {
            code: "OFFLINE",
            update_type: "auto",
          });
        }
      });
    });
    expressApp.use(cors(corsPolicy));
    expressApp.use(express.json());
    expressApp.use(express.raw({ limit: "1mb" }));

    //After email verification, use this API
    expressApp.use("/signup/api", signupTokenAuthority);
    // Authenticated Login Endpoints
    expressApp.use("/api", tokenAuthority);

    expressApp.use(route);

    //Assets
    expressApp.get("/assets/:assetId", async (req, res) => {
      const assetID = req.params.assetId;
      const IconsPath = path.resolve(__dirname, "icons");
      let fileName = "";
      switch (assetID) {
        case "chit-chat-logo-regular":
          fileName = "chit-chat-logo.jpg";
          break;
        default:
          fileName = "invalid-file";
      }
      if (existsSync(path.join(IconsPath, fileName))) {
        res.sendFile(path.join(IconsPath, fileName));
      } else {
        res.status(404).send("Not Found!");
      }
    });
    mongoDbClient.connect().then(() => {
      console.log("Worker %d connected with db", process.pid);
    });
  }
} catch (e) {
  console.error("ServerError:", e);
}
