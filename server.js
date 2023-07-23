import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "http";
import { SOCKET_HANDLERS } from "./ENUMS.js";
import { chatsCollection, connectionsData, mongoDbClient, myProfile, verifyUser } from "./mongoDBhelper/index.js";
import { ObjectId } from "mongodb";
import { generateNewToken, validateToken } from "./utils/index.js";

const expressApp = express();
const server = createServer(expressApp);
const io = new Server(server, { cors: { origin: "http://localhost:5173", credentials: true } });

const LATENCY = 2000;

// APIs
expressApp.use(cors({ origin: "http://localhost:5173", credentials: true }));
expressApp.use(express.json());
expressApp.post("/login", async (req, res) => {
  const { username, password } = req.body;
  // TODO:
  //* Verify the username and password
  if (username && password) {
    const { userExists, credentialsMatch, userId } = await verifyUser(username, password);
    if (!userExists) res.send("User does not exists!");
    else if (!credentialsMatch) res.send("Username or Password is not correct!");
    else {
      let token = generateNewToken({ userId });
      res.status(202).send({ token, expiryDate: new Date().toUTCString() });
      //* Create a token after verification
      //* Send the token with response
    }
  }
});

expressApp.get("/username_checker", (req, res) => {
  setTimeout(() => {
    if (req.query.username && req.query.username === "harshdagar") {
      res.send({ available: false });
    } else {
      res.send({ available: true });
    }
  }, 2000);
});

expressApp.use("/api", (req, res, next) => {
  const authToken = req.headers.authorization?.split(" ")[1];
  if (authToken) {
    validateToken(authToken, (data) => {
      if (data) {
        console.log(data);
        // throw new Error("I want to stop");
        req.userId = data.userId;
        next();
      } else {
        res.sendStatus(401);
      }
    });
  } else {
    res.sendStatus(401);
  }
});
expressApp.get("/api/me", async (req, res) => {
  console.log(req.userId, "userId");
  try {
    const profileData = await myProfile(req.userId);
    res.json(profileData);
  } catch (e) {
    console.log("/ProfileAPIError:", e);
    res.sendStatus(500);
  }
});
expressApp.get("/api/connections", async function (req, res) {
  try {
    const data = await connectionsData(req.userId);
    res.json({
      contacts: data.connections,
      chats: data.chats,
    });
  } catch (e) {
    console.error("/ConnectionsAPIError:", e);
    res.sendStatus(500);
  }
});

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
    let { participants } = await chatsCollection.findOne({ _id: documentKey._id });
    participants = participants.map((objectid) => objectid.toString());
    if (participants.indexOf(loggedInUserId) > -1) {
      console.log("User Specific update");
      console.log(updatedFields.messages);
      if (operationType === "update") {
        if (!JSON.stringify(updatedFields).includes(loggedInUserId)) {
          // Update only limited to receiver
          if (updatedFields.authors_typing) {
            //Typing Status
            socket.emit(SOCKET_HANDLERS.CHAT.typingStatusUpdate, documentKey._id, updatedFields.authors_typing);
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
      chatsCollection.updateOne({ _id: new ObjectId(chat_id) }, { $addToSet: { authors_typing: new ObjectId(author.authorId) } });
    } else {
      chatsCollection.updateOne({ _id: new ObjectId(chat_id) }, { $pull: { authors_typing: new ObjectId(author.authorId) } });
    }
  });

  socket.on(SOCKET_HANDLERS.CHAT.newMessage, (chat_id, messageObject) => {
    let currentTime = new Date();
    messageObject.timestamp = currentTime;

    chatsCollection.updateOne({ _id: new ObjectId(chat_id) }, { $push: { messages: messageObject }, $set: { last_updated: currentTime } });
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
