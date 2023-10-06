const { config } = require("dotenv");
config();
const { MongoClient, ObjectId } = require("mongodb");
const {
  ProfileDataProjection,
  UserProfileProjection,
} = require("./projections.js");
const { USER_STATUS } = require("../utils/enums.js");

const mongoDbClient = new MongoClient(
  `mongodb+srv://${process.env.DB_UserName}:${encodeURIComponent(
    process.env.DB_PassWord
  )}@cluster0.qsbznrs.mongodb.net/?retryWrites=true&w=majority`
);
const db = mongoDbClient.db("chit-chat");
const chatsCollection = db.collection("chats"),
  usersCollection = db.collection("users");

/*
 !    API Functions
        -> Functions that are used to provide the initial API response
 ?      User Profile
 */
async function getProfileById(id, myOwnProfile = false) {
  if (typeof id === "string") {
    return await usersCollection.findOne(
      { _id: new ObjectId(id) },
      {
        projection: myOwnProfile
          ? UserProfileProjection
          : ProfileDataProjection,
      }
    );
  } else if (Array.isArray(id)) {
    return await usersCollection
      .find(
        {
          _id: {
            $in: id.map((id) => new ObjectId(id)),
          },
        },
        {
          projection: ProfileDataProjection,
        }
      )
      .toArray();
  }
}

async function getConnectionData(userId, connectionId) {
  const { connectionData } = await usersCollection.findOne(
    { _id: new ObjectId(userId) },
    { projection: { _id: 0, connectionData: `$connections.${connectionId}` } }
  );
  return connectionData;
}

//?   Login
async function verifyUser(username, password) {
  const user = await usersCollection.findOne({
    $or: [{ username }, { email: username }],
  });
  const result = { userExists: false, credentialsMatch: false, userId: "" };
  if (user) {
    result.userExists = true;
    console.log(user.password, password);
    if (user.password === password) {
      result.credentialsMatch = true;
      result.userId = user._id;
    }
  }
  return result;
}

//     Connections Data for initial request
async function connectionsData(userId) {
  const { connections } = await usersCollection.findOne(
    { _id: new ObjectId(userId) },
    { projection: { _id: 0, connections: 1 } }
  );

  const contactIds = Object.keys(connections).map((id) => new ObjectId(id));
  const contactsUnseenMsgCountCommand = {
    unseen_messages_count: `$connections.${userId}.unseen_messages_count`,
  };
  const contactsArray = await usersCollection
    .find(
      { _id: { $in: contactIds } },
      {
        projection: {
          ...ProfileDataProjection,
          ...contactsUnseenMsgCountCommand,
        },
      }
    )
    .toArray();

  const seenByPropertyMapped = {};
  contactsArray.forEach((contact) => {
    //*  Adding profileData for each connection
    seenByPropertyMapped[connections[contact.id].chat_id] =
      contact.unseen_messages_count === 0;
    delete contact.unseen_messages_count;
    Object.assign(connections[contact.id], contact);
  });

  const chatIds = Object.values(connections).map(
    ({ chat_id }) => new ObjectId(chat_id)
  );

  const chatsArray = await getChat(chatIds);
  chatsArray.forEach((chat, index) => {
    chatsArray[index].seenByConnection = seenByPropertyMapped[chat.chat_id];
  });

  return {
    connections,
    chats: chatsArray,
    chatIds: chatIds.map((objectId) => objectId.toString()),
    hasData: contactIds.length > 0 && chatsArray.length > 0,
  };
}

async function getChat(chatIds = [], initialMessagesCount = 20) {
  return await chatsCollection //*  Providing chat data with last 20 messages
    .find(
      { _id: { $in: chatIds } },
      {
        projection: {
          _id: 0,
          chat_id: "$_id",
          participants: 1,
          last_updated: 1,
          created_at: 1,
          authors_typing: 1,
          messages: { $slice: ["$messages", -1 * initialMessagesCount] },
        },
      }
    )
    .toArray();
}

async function isUsernameAvailable(user_provided_username) {
  const user = await usersCollection.findOne({
    username: user_provided_username,
  });
  return !user ? true : false;
}

async function isEmailAlreadyRegistered(email_address) {
  const user = await usersCollection.findOne({ email: email_address });
  return user ? user._id : false;
}

async function findUser(query) {
  const users = await usersCollection
    .aggregate([
      {
        $search: {
          index: "user-search-index",
          text: {
            query,
            path: ["firstName", "lastName", "username"],
          },
          sort: {
            firstName: 1,
          },
        },
      },
      {
        $project: ProfileDataProjection,
      },
    ])
    .toArray();
  return users;
}

async function createNewAccount({
  about,
  firstName,
  lastName,
  email,
  password,
  username,
  profile_picture_url,
}) {
  const newUser = await usersCollection.insertOne({
    profile_type: "person",
    about,
    firstName,
    lastName,
    status: {
      code: "ONLINE",
      update_type: "auto",
    },
    avatar: {
      url: "",
      key: profile_picture_url,
    },
    last_active: "",
    connections: {},
    email,
    password,
    username,
    created_at: new Date(),
    blocked_ids: [],
  });
  console.log(newUser);
  return newUser;
}

async function createNewChat(participant_Ids = [], messageObject = null) {
  if (messageObject) {
    messageObject.timestamp = new Date();
  }
  const newChat = await chatsCollection.insertOne({
    authors_typing: [],
    created_at: new Date(),
    last_updated: new Date(),
    messages: messageObject ? [messageObject] : [],
    participants: participant_Ids,
  });
  return newChat;
}

async function setProfilePictureUrl(user_id, url) {
  return usersCollection.updateOne(
    { _id: new ObjectId(user_id) },
    { $set: { "avatar.url": url } }
  );
}

async function addConnection(fromContactId, toContactId, messageObject = {}) {
  const newChat = await createNewChat(
    [new ObjectId(fromContactId)],
    messageObject
  );
  const newConnectionInSender = {
    $set: {
      [`connections.${toContactId}`]: {
        unseen_messages_count: 0,
        chat_id: new ObjectId(newChat.insertedId),
      },
    },
  };
  const newConnectionInReceiver = {
    $set: {
      [`connections.${fromContactId}`]: {
        unseen_messages_count: 1,
        chat_id: new ObjectId(newChat.insertedId),
      },
    },
  };
  await usersCollection.bulkWrite(
    [
      {
        updateOne: {
          filter: { _id: new ObjectId(fromContactId) },
          update: newConnectionInSender,
        },
      },
      {
        updateOne: {
          filter: { _id: new ObjectId(toContactId) },
          update: newConnectionInReceiver,
        },
      },
    ],
    {
      ordered: false,
    }
  );
  return {
    chat_id: newChat.insertedId,
  };
}

async function addMessage(chat_id, messageObject) {
  await chatsCollection.updateOne(
    { _id: new ObjectId(chat_id) },
    {
      $push: { messages: messageObject },
      $set: { last_updated: messageObject.timestamp },
    }
  );
}
async function updateUnseenMsgCount(senderId, receiverId, INCREASE = true) {
  const update = {
    [INCREASE ? "$inc" : "$set"]: {
      [`connections.${senderId}.unseen_messages_count`]: INCREASE ? 1 : 0,
    },
  };
  const collectionUpdate = await usersCollection.updateMany(
    {
      _id: new ObjectId(receiverId),
    },
    update
  );
}

async function clearChat(chat_id, from, to) {
  return await Promise.all([
    chatsCollection.updateOne(
      {
        _id: new ObjectId(chat_id),
      },
      {
        $set: {
          messages: [],
        },
      }
    ),
    usersCollection.updateOne(
      {
        _id: new ObjectId(to),
      },
      {
        $set: {
          [`connections.${from}.unseen_messages_count`]: 0,
        },
      }
    ),
  ]);
}

async function deleteChat(chatId, fromId, connectionId, toBlock = false) {
  if (chatId) {
    const updateQuerySender = {
      $unset: {
        [`connections.${connectionId}`]: "",
      },
    };
    const receiverQuery = {
      $unset: {
        [`connections.${fromId}`]: "",
      },
    };
    if (toBlock) {
      updateQuerySender["$push"] = {
        blocked_users: new ObjectId(connectionId),
      };
    }
    await Promise.all([
      usersCollection.bulkWrite([
        {
          updateOne: {
            filter: {
              _id: new ObjectId(fromId),
            },
            update: updateQuerySender,
          },
        },
        {
          updateOne: {
            filter: {
              _id: new ObjectId(connectionId),
            },
            update: receiverQuery,
          },
        },
      ]),
      chatsCollection.deleteOne({
        _id: new ObjectId(chatId),
      }),
    ]);
  }
  return;
}

async function updateStatus(userId, { code, update_type }) {
  const update = {
    $set: {
      status: {
        code,
        update_type,
      },
      last_active: code === USER_STATUS.OFFLINE ? new Date() : "",
    },
  };
  usersCollection.updateOne(
    {
      _id: new ObjectId(userId),
    },
    update
  );
}

async function acceptMessageRequest(chatId, accepterId) {
  return chatsCollection.updateOne(
    {
      _id: new ObjectId(chatId),
    },
    {
      $push: {
        participants: new ObjectId(accepterId),
      },
    }
  );
}
module.exports = {
  //MongoDBClient
  mongoDbClient,
  //Collections
  chatsCollection,
  usersCollection,
  // Functions
  addConnection,
  addMessage,
  acceptMessageRequest,
  getProfileById,
  getConnectionData,
  connectionsData,
  clearChat,
  deleteChat,
  verifyUser,
  getChat,
  isUsernameAvailable,
  isEmailAlreadyRegistered,
  createNewAccount,
  setProfilePictureUrl,
  findUser,
  updateUnseenMsgCount,
  updateStatus,
};
