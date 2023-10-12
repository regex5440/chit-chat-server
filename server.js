const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { createServer } = require("http");
const { SOCKET_HANDLERS, USER_STATUS } = require("./utils/enums.js");
const {
  mongoDbClient,
  addConnection,
  getChat,
  getProfileById,
  getConnectionData,
  connectionsData,
  addMessage,
  updateUnseenMsgCount,
  clearChat,
  deleteChat,
  updateStatus,
  acceptMessageRequest,
  isUserRestricted,
} = require("./MongoDB_Helper/index.js");
const { signupTokenAuthority, tokenAuthority } = require("./API/middleware.js");
const {
  userProfileData,
  userNameChecker,
  imageHandler,
  registerUser,
  userSearchHandler,
} = require("./API/Authenticated/endpoint_handler.js");
const {
  emailValidation,
  loginAuthentication,
  oAuthHandler,
} = require("./API/endpoint_handler.js");
const { existsSync } = require("fs");
const path = require("path");
const { validateToken } = require("./utils/jwt.js");
const { removeRData } = require("./Redis_Helper/index.js");

const expressApp = express();

const server = createServer(expressApp);
const corsPolicy = {
  origin: process.env.Client_URL,
  credentials: true,
};
const io = new Server(server, {
  cors: corsPolicy,
});

expressApp.use(cors(corsPolicy));
expressApp.use(express.json());
expressApp.use(express.raw({ limit: "1mb" }));

//Signup Endpoints
expressApp.use("/email_verifier", emailValidation);

//After email verification, use this API
expressApp.use("/signup/api", signupTokenAuthority);
expressApp.get("/signup/api/username_checker", userNameChecker);
expressApp.use("/signup/api/register", registerUser);

expressApp.post("/oauth_process", oAuthHandler);

// Login Endpoint
expressApp.post("/login", loginAuthentication);

// Authenticated Login Endpoints
expressApp.use("/api", tokenAuthority);
expressApp.get("/api/me", userProfileData);
expressApp.post("/api/imageUploader", imageHandler);
expressApp.get("/api/findUser", userSearchHandler);

expressApp.get("/api/log_out", async (req, res) => {
  if (req.headers.authorization) {
    await removeRData(req.headers.authorization.split(" ")?.[1]);
    res.send("ok");
  }
  res.status(401).send();
});
// Socket
io.on("connection", async (socket) => {
  // console.log("Socket CONNECTED", socket.rooms);
  //TODO: Optimize Authorization if possible
  let authToken = socket.handshake.headers.authorization.split(" ")[1];
  let loggedInUserId = "";
  try {
    if (authToken.length < 10) {
      throw new Error("Invalid Auth Token");
    }
    console.log({ authToken });
    const data = await validateToken(authToken);
    if (data.data) {
      loggedInUserId = data.data.id;
      console.log("VALIDATED SOCKET", loggedInUserId);
    }
  } catch (e) {
    if (e) {
      socket.disconnect(true);
      return;
    }
  }

  const { chatIds, chats, connections, hasData } = await connectionsData(
    loggedInUserId
  );
  socket.emit(SOCKET_HANDLERS.CONNECTION.ConnectionData, {
    hasData,
    chats,
    connections,
  });
  if (chatIds.length > 0) {
    socket.join(chatIds);
  }
  socket.join(`${loggedInUserId}-req`); //New Request Room

  socket.on(
    SOCKET_HANDLERS.CONNECTION.StatusUpdate,
    (userId, { code, update_type }) => {
      if (!code || !update_type) return;
      if (socket.rooms.size > 2) {
        const roomIds = new Set(socket.rooms);
        roomIds.delete(`${loggedInUserId}-req`);
        socket
          .to([...roomIds])
          .emit(SOCKET_HANDLERS.CONNECTION.StatusUpdate, userId, {
            code,
            lastActive:
              code === USER_STATUS.OFFLINE ? new Date().toISOString() : "",
          });
      }
      updateStatus(userId, { code, update_type });
    }
  );
  socket.on(
    SOCKET_HANDLERS.CHAT.NewRequest,
    async ({ receiverId, messageObject }) => {
      const isBlocked = await isUserRestricted(loggedInUserId, receiverId);
      if (isBlocked) {
        socket.emit(
          SOCKET_HANDLERS.CHAT.NewRequest_Failed,
          "You can no longer message this contact"
        );
        return;
      }

      const { chat_id } = await addConnection(
        loggedInUserId,
        receiverId,
        messageObject
      );
      socket.join(chat_id.toString());
      const [
        chats,
        [profile1, profile2],
        senderConnectionData,
        receiverConnectionData,
      ] = await Promise.all([
        getChat([chat_id]),
        getProfileById([loggedInUserId, receiverId]),
        getConnectionData(loggedInUserId, receiverId),
        getConnectionData(receiverId, loggedInUserId),
      ]);
      socket.emit(SOCKET_HANDLERS.CHAT.NewRequest_Success, {
        chat: chats[0],
        connectionProfile: {
          ...(profile1.id.toString() === loggedInUserId ? profile2 : profile1),
          ...senderConnectionData,
        },
      });
      socket
        .to(`${receiverId}-req`)
        .emit(SOCKET_HANDLERS.CHAT.NewRequest_Success, {
          chat: chats[0],
          connectionProfile: {
            ...(profile1.id.toString() !== loggedInUserId
              ? profile2
              : profile1),
            ...receiverConnectionData,
          },
        });
    }
  );

  socket.on(
    SOCKET_HANDLERS.CHAT.NewRequest_Accepted,
    async (chatId, fromId) => {
      await acceptMessageRequest(chatId, fromId);
      socket
        .to(chatId)
        .emit(SOCKET_HANDLERS.CHAT.NewRequest_Accepted, chatId, fromId);
    }
  );

  socket.on(SOCKET_HANDLERS.CHAT.JoinRoom, (chatId) => {
    socket.join(chatId);
  });

  socket.on(SOCKET_HANDLERS.CHAT.LeaveRoom, (chat_id) => {
    socket.leave(chat_id);
  });

  socket.on(SOCKET_HANDLERS.CHAT.TypingUpdate, (chat_id, author) => {
    if (chat_id && author) {
      socket
        .to(chat_id)
        .emit(SOCKET_HANDLERS.CHAT.TypingUpdate, chat_id, author);
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

  socket.on(
    SOCKET_HANDLERS.CHAT.NewMessage,
    ({ chat_id, receiverId, messageObject }) => {
      let currentTime = new Date();
      messageObject.timestamp = currentTime;
      try {
        Promise.all([
          addMessage(chat_id, messageObject),
          updateUnseenMsgCount(messageObject.sender_id, receiverId),
        ]);
        io.in(chat_id).emit(
          SOCKET_HANDLERS.CHAT.NewMessage,
          chat_id,
          currentTime,
          messageObject
        );
      } catch (e) {
        console.log("MessageTransferFailed:", e);
      }
    }
  );

  socket.on(
    SOCKET_HANDLERS.CHAT.SeenUpdate,
    (chat_id, seenByUserId, toReceiverId) => {
      io.to(chat_id).emit(
        SOCKET_HANDLERS.CHAT.SeenUpdate,
        chat_id,
        seenByUserId
      );
      updateUnseenMsgCount(toReceiverId, seenByUserId, false);
    }
  );

  socket.on(SOCKET_HANDLERS.CHAT.ClearAll, async ({ chatId, fromId, toId }) => {
    await clearChat(chatId, fromId, toId);
    socket.to(chatId).emit(SOCKET_HANDLERS.CHAT.ClearAll, chatId, fromId);
  });

  socket.on(
    SOCKET_HANDLERS.CONNECTION.RemoveConnection,
    async (chatId, { fromUserId, toUserId, toBlock }) => {
      await deleteChat(chatId, fromUserId, toUserId, toBlock);
      socket
        .to(chatId)
        .emit(SOCKET_HANDLERS.CONNECTION.RemoveConnection, fromUserId, chatId);
      socket.leave(chatId);
    }
  );
  socket.on("disconnect", (reason) => {
    // socket
    //   .to(chatIds)
    //   .emit(
    //     SOCKET_HANDLERS.CONNECTION.StatusUpdate,
    //     (loggedInUserId,
    //     { status: USER_STATUS.OFFLINE, last_active: new Date() })
    //   );
    // updateStatus(loggedInUserId, USER_STATUS.OFFLINE);
  });
});

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

try {
  mongoDbClient.connect().then(() => {
    server.listen(5000, function () {
      console.log("Started at port 5000");
    });
  });
} catch (e) {
  console.error("MongoConnectError:", e);
}
