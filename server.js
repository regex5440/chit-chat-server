const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { createServer } = require("http");
const { SOCKET_HANDLERS } = require("./utils/enums.js");
const {
  chatsCollection,
  mongoDbClient,
  addConnection,
  getChat,
  findUser,
  getProfileById,
  getConnectionData,
  connectionsData,
} = require("./MongoDB_Helper/index.js");
const { ObjectId } = require("mongodb");
const { signupTokenAuthority, tokenAuthority } = require("./API/middleware.js");
const {
  connectionProfileData,
  userProfileData,
  userNameChecker,
  imageHandler,
  registerUser,
  userSearchHandler,
} = require("./API/Authenticated/endpoint_handler.js");
const {
  emailValidation,
  loginAuthentication,
} = require("./API/endpoint_handler.js");
const { existsSync } = require("fs");
const path = require("path");
const { validateToken } = require("./utils/jwt.js");

const expressApp = express();

const server = createServer(expressApp);
const corsPolicy = {
  origin: "http://localhost:5173",
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

// Login Endpoint
expressApp.post("/login", loginAuthentication);
// Authenticated Login Endpoints
expressApp.use("/api", tokenAuthority);
expressApp.get("/api/me", userProfileData);
expressApp.post("/api/imageUploader", imageHandler);
expressApp.get("/api/findUser", userSearchHandler);

// Socket
io.on("connection", async (socket) => {
  // console.log("Socket CONNECTED", socket.rooms);
  //TODO: Optimize Authorization if possible
  let authToken = socket.handshake.headers.authorization.split(" ")[1];
  let loggedInUserId = "";
  try {
    validateToken(authToken, (data) => {
      if (data) {
        loggedInUserId = data.userId;
        console.log("VALIDATED SOCKET", loggedInUserId);
      }
    });
  } catch (e) {
    if (e) {
      socket.disconnect(true);
      return;
    }
  }

  //TODO: Send connections here
  const { chatIds, chats, connections, hasData } = await connectionsData(
    loggedInUserId
  );
  socket.emit(SOCKET_HANDLERS.CONNECTION_DATA, { hasData, chats, connections });

  //TODO: Join the room of chat_ids
  socket.join(chatIds);

  //TODO: Setup handlers for room updates

  // const chatStream = chatsCollection.watch();
  // chatStream.on("change", async (document) => {
  //   console.log(document);
  //   if (document.operationType !== "update") return;
  //   const {
  //     documentKey,
  //     updateDescription: { updatedFields },
  //     operationType,
  //   } = document;
  //   let { participants } = await chatsCollection.findOne({
  //     _id: documentKey._id,
  //   });
  //   participants = participants.map((objectid) => objectid.toString());
  //   if (participants.indexOf(loggedInUserId) > -1) {
  //     console.log("User Specific update");
  //     console.log(updatedFields.messages);
  //     if (operationType === "update") {
  //       if (!JSON.stringify(updatedFields).includes(loggedInUserId)) {
  //         // Update only limited to receiver
  //         if (updatedFields.authors_typing) {
  //           //Typing Status
  //           socket.emit(
  //             SOCKET_HANDLERS.CHAT.typingStatusUpdate,
  //             documentKey._id,
  //             updatedFields.authors_typing
  //           );
  //         }
  //         if (updatedFields.last_updated) {
  //           // New message added to chat
  //           const messageData = Object.values(updatedFields)[1];
  //           // if (messageData.sender_id !== loggedInUserId) {
  //           socket.emit(SOCKET_HANDLERS.CHAT.newMessage, documentKey._id, {
  //             last_updated: updatedFields.last_updated,
  //             message: messageData,
  //           });
  //           // }
  //         }
  //       }
  //     }
  //   }
  //   // socket.emit(SOCKET_HANDLERS.CHAT.typingStatus,)
  // });

  socket.on(SOCKET_HANDLERS.CHAT.newRequest, async (receiverId, message) => {
    const { chat_id } = await addConnection(
      loggedInUserId,
      receiverId,
      message
    );
    const [chats, receiverProfile, connectionData] = await Promise.all([
      getChat([chat_id]),
      getProfileById(receiverId),
      getConnectionData(loggedInUserId, receiverId),
    ]);
    socket.emit(SOCKET_HANDLERS.CHAT.newRequstSuccess, {
      chat: chats[0],
      connectionProfile: { ...receiverProfile, ...connectionData },
    });
  });

  socket.on(SOCKET_HANDLERS.CHAT.typingStatusUpdate, (chat_id, author) => {
    if (chat_id && author) {
      if (author.isTyping) {
        chatsCollection.updateOne(
          { _id: new ObjectId(chat_id) },
          { $addToSet: { authors_typing: new ObjectId(author.authorId) } }
        );
      } else {
        chatsCollection.updateOne(
          { _id: new ObjectId(chat_id) },
          { $pull: { authors_typing: new ObjectId(author.authorId) } }
        );
      }
    }
  });

  socket.on(SOCKET_HANDLERS.CHAT.newMessage, (chat_id, messageObject) => {
    socket.broadcast.emit(
      "message",
      messageObject.text + " from " + messageObject.sender_id
    );
    return;

    let currentTime = new Date();
    messageObject.timestamp = currentTime;

    chatsCollection.updateOne(
      { _id: new ObjectId(chat_id) },
      {
        $push: { messages: messageObject },
        $set: { last_updated: currentTime },
      }
    );
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
