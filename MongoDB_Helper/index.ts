import { config } from "dotenv";
config();
import { MongoClient, ObjectId, UpdateFilter } from "mongodb";
import {
  ProfileDataProjection,
  UserProfileProjection,
  ProfileSearchResults,
} from "./projections";
import { USER_STATUS } from "../utils/enums";
import { type } from "os";

const mongoDbClient = new MongoClient(
  `mongodb+srv://${process.env.DB_UserName}:${encodeURIComponent(
    process.env.DB_PassWord || ''
  )}@cluster0.qsbznrs.mongodb.net/?retryWrites=true&w=majority`
);
const db = mongoDbClient.db("chit-chat");
const chatsCollection = db.collection("chats"),
  usersCollection = db.collection("users");

type MessageObject = { timestamp: string | Date, type: 'text', text: string, sender_id: string, id?: ObjectId, seenByRecipients?: ObjectId[] }
/*
 !    API Functions
        -> Functions that are used to provide the initial API response
 ?      User Profile
 */
async function getProfileById<T extends string | string[]>(id: T, myOwnProfile = false) {
  let data: any = null;
  if (typeof id === "string") {
    data = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      {
        projection: myOwnProfile
          ? UserProfileProjection
          : ProfileDataProjection,
      }
    );
  } else if (Array.isArray(id)) {
    data = await usersCollection
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

  if (data) {
    return data as (T extends string ? keyof typeof UserProfileProjection : keyof typeof UserProfileProjection[])
  }
  return data;
}

async function getConnectionData(userId: string, connectionId: string) {
  const data = await usersCollection.findOne(
    { _id: new ObjectId(userId) },
    { projection: { _id: 0, connectionData: `$connections.${connectionId}` } }
  )
  return data?.connectionData;
}

//?   Login
async function verifyUser(username: string, password: string) {
  const user = await usersCollection.findOne({
    $or: [{ username }, { email: username }],
  });
  const result = { userExists: false, credentialsMatch: false, userId: "" };
  if (user) {
    result.userExists = true;
    console.log(user.password, password);
    if (user.password === password) {
      result.credentialsMatch = true;
      result.userId = user._id.toString();
    }
  }
  return result;
}

//     Connections Data for initial request
async function connectionsData(userId: string) {
  const data = await usersCollection.findOne(
    { _id: new ObjectId(userId) },
    { projection: { _id: 0, connections: 1 } }
  );
  if (!data) return { connections: {}, chats: [], chatIds: [], hasData: false };
  const connections: {
    [key: string]: {
      chat_id: string,
      unseen_messages_count: number,
    }
  } = data.connections;

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

  const seenByPropertyMapped: {
    [userId: string]: boolean
  } = {};
  contactsArray.forEach((contact) => {
    //*  Adding profileData for each connection
    seenByPropertyMapped[connections[contact.id].chat_id] =
      contact.unseen_messages_count === 0;
    delete contact.unseen_messages_count;
    Object.assign(connections[contact.id], contact);
  });

  const chatIds = Object.values(connections).map(
    (chat) => new ObjectId((chat as { chat_id: string }).chat_id)
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

async function getChat(chatIds: ObjectId[] = [], initialMessagesCount = 20) {
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
          created_by: 1,
        },
      }
    )
    .toArray();
}

async function isUsernameAvailable(user_provided_username: string) {
  const user = await usersCollection.findOne({
    username: user_provided_username,
  });
  return !user ? true : false;
}

async function isEmailAlreadyRegistered(email_address: string) {
  const user = await usersCollection.findOne({ email: email_address });
  return user ? user._id : false;
}

async function findUser(query: string) {
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
        $project: ProfileSearchResults,
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
}: {
  about: string,
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  username: string,
  profile_picture_url: string,
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

async function createNewChat(creatorId: string, messageObject: MessageObject | null = null) {
  if (messageObject) {
    messageObject.timestamp = new Date();
    messageObject.id = new ObjectId();
    messageObject.seenByRecipients = [];
  }
  const newChat = await chatsCollection.insertOne({
    authors_typing: [],
    created_at: new Date(),
    last_updated: new Date(),
    messages: messageObject ? [messageObject] : [],
    participants: [new ObjectId(creatorId)],
    created_by: new ObjectId(creatorId),
  });
  return newChat;
}

async function setProfilePictureUrl(user_id: string, url: string) {
  return usersCollection.updateOne(
    { _id: new ObjectId(user_id) },
    { $set: { "avatar.url": url } }
  );
}

async function addConnection(fromContactId: string, toContactId: string, messageObject: MessageObject) {
  const newChat = await createNewChat(fromContactId, messageObject);
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

async function addMessage(chat_id: string, messageObject: MessageObject) {
  const id = new ObjectId();
  await chatsCollection.updateOne(
    { _id: new ObjectId(chat_id) },
    {
      $push: { messages: { ...messageObject, id } },
      $set: { last_updated: messageObject.timestamp },
    }
  )
  return id.toString();
}
async function updateSeenMessages(chat_id: string, seenById: string, messageId: string) {
  return await chatsCollection.updateOne(
    {
      _id: new ObjectId(chat_id),
      "messages.id": new ObjectId(messageId),
    },
    {
      $addToSet: {
        "messages.$.seenByRecipients": new ObjectId(seenById),
      },
    }
  );
}
async function updateUnseenMsgCount(senderId: string, receiverId: string, INCREASE = true) {
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

async function clearChat(chat_id: string, from: string, to: string) {
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

async function deleteChat(chatId: string, fromId: string, connectionId: string, toBlock = false) {
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
      blocked_users: connectionId,
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
  ]);
  if (chatId) {
    await chatsCollection.deleteOne({
      _id: new ObjectId(chatId),
    });
  }
  return;
}

async function updateStatus(userId: string, { code, update_type }: { code: keyof typeof USER_STATUS, update_type: 'auto' | 'manual' }) {
  const update: UpdateFilter<Document> | Partial<Document> = {
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

async function acceptMessageRequest(chatId: string, accepterId: string) {
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

async function isUserRestricted(restrictId: string, userId: string) {
  const result = await usersCollection.findOne(
    {
      _id: new ObjectId(userId),
      blocked_users: { $in: [restrictId] },
    },
    { projection: { _id: 1 } }
  );

  return result?._id ? true : false;
}
export {
  //MongoDBClient
  mongoDbClient,
  //Collections
  chatsCollection,
  usersCollection,
  // Functions
  addConnection,
  addMessage,
  updateSeenMessages,
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
  isUserRestricted,
  createNewAccount,
  setProfilePictureUrl,
  findUser,
  updateUnseenMsgCount,
  updateStatus,
};
