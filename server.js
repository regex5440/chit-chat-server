import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "http";
import { SOCKET_HANDLERS } from "./utils/enums.js";
import { chatsCollection, mongoDbClient } from "./MongoDB_Helper/index.js";
import { ObjectId } from "mongodb";
import { signupTokenAuthority, tokenAuthority } from "./API/middleware.js";
import {
  connectionProfileData,
  userProfileData,
  userNameChecker,
  imageHandler,
} from "./API/Authenticated/api_endpoints.js";
import { emailValidation, loginAuthentication } from "./API/endpoints.js";

const expressApp = express();

const server = createServer(expressApp);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", credentials: true },
});

expressApp.use(cors({ origin: "http://localhost:5173", credentials: true }));
expressApp.use(express.json());

//Signup Endpoints

expressApp.use("/email_verifier", emailValidation);

//After email verification, use this API
expressApp.use("/signup/api", signupTokenAuthority);
expressApp.get("/signup/api/username_checker", userNameChecker);
expressApp.use("/signup/api/imageUploader", imageHandler);

// Login Endpoint
expressApp.post("/login", loginAuthentication);
// Authenticated Login Endpoints
expressApp.use("/api", tokenAuthority);
expressApp.get("/api/me", userProfileData);
expressApp.get("/api/connections", connectionProfileData);

// Socket
io.on("connection", async (socket) => {
  // console.log("Socket CONNECTED", socket);
  let authToken = socket.handshake.headers.authorization;
  let loggedInUserId = "";
  if (authToken === "xyz") {
    loggedInUserId = "645645674572e93ac7213b53";
  } else if (authToken === "abc") {
    loggedInUserId = "645646504572e93ac7213b54";
  }

  const chatStream = chatsCollection.watch();
  chatStream.on("change", async (document) => {
    console.log(document);
    const {
      documentKey,
      updateDescription: { updatedFields },
      operationType,
    } = document;
    let { participants } = await chatsCollection.findOne({
      _id: documentKey._id,
    });
    participants = participants.map((objectid) => objectid.toString());
    if (participants.indexOf(loggedInUserId) > -1) {
      console.log("User Specific update");
      console.log(updatedFields.messages);
      if (operationType === "update") {
        if (!JSON.stringify(updatedFields).includes(loggedInUserId)) {
          // Update only limited to receiver
          if (updatedFields.authors_typing) {
            //Typing Status
            socket.emit(
              SOCKET_HANDLERS.CHAT.typingStatusUpdate,
              documentKey._id,
              updatedFields.authors_typing
            );
          }
          if (updatedFields.last_updated) {
            // New message added to chat
            const messageData = Object.values(updatedFields)[1];
            // if (messageData.sender_id !== loggedInUserId) {
            socket.emit(SOCKET_HANDLERS.CHAT.newMessage, documentKey._id, {
              last_updated: updatedFields.last_updated,
              message: messageData,
            });
            // }
          }
        }
      }
    }
    // socket.emit(SOCKET_HANDLERS.CHAT.typingStatus,)
  });

  socket.on(SOCKET_HANDLERS.CHAT.typingStatusUpdate, (chat_id, author) => {
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
  });

  socket.on(SOCKET_HANDLERS.CHAT.newMessage, (chat_id, messageObject) => {
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

mongoDbClient
  .connect()
  .then(() => {
    server.listen(5000, function () {
      console.log("Started at port 5000");
    });
  })
  .catch((err) => console.error("MongoConnectError:", err));
