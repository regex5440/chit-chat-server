import { config } from "dotenv";
config();
import { MongoClient, ObjectId, UpdateFilter } from "mongodb";
import { ProfileDataProjection, UserProfileProjection, ProfileSearchResults } from "./projections";
import { USER_STATUS } from "../utils/enums";
import { MessageObject, MessageUpdate } from "../@types";
import { getPostSignedURL, removeAsset, removeDirectory } from "../CloudFlare_Helper";

const mongoDbClient = new MongoClient(
  `mongodb+srv://${process.env.DB_UserName}:${encodeURIComponent(
    process.env.DB_PassWord || "",
  )}@cluster0.qsbznrs.mongodb.net/?retryWrites=true&w=majority`,
);
const db = mongoDbClient.db("chit-chat");
const chatsCollection = db.collection("chats"),
  usersCollection = db.collection("users");
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
        projection: myOwnProfile ? UserProfileProjection : ProfileDataProjection,
      },
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
        },
      )
      .toArray();
  }

  if (data) {
    return data as T extends string ? keyof typeof UserProfileProjection : keyof (typeof UserProfileProjection)[];
  }
  return data;
}

async function getConnectionData(userId: string, connectionId: string) {
  const data = await usersCollection.findOne(
    { _id: new ObjectId(userId) },
    { projection: { _id: 0, connectionData: `$connections.${connectionId}` } },
  );
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
    if (user.password === password) {
      result.credentialsMatch = true;
      result.userId = user._id.toString();
    }
  }
  return result;
}

//     Connections Data for initial request
async function connectionsData(userId: string) {
  const data = await usersCollection.findOne({ _id: new ObjectId(userId) }, { projection: { _id: 0, connections: 1 } });
  if (!data) return { connections: {}, chats: [], chatIds: [], hasData: false };
  const connections: {
    [key: string]: {
      chat_id: string;
      unseen_messages_count: number;
    };
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
      },
    )
    .toArray();

  const seenByPropertyMapped: {
    [userId: string]: boolean;
  } = {};
  contactsArray.forEach((contact) => {
    //*  Adding profileData for each connection
    seenByPropertyMapped[connections[contact.id].chat_id] = contact.unseen_messages_count === 0;
    delete contact.unseen_messages_count;
    Object.assign(connections[contact.id], contact);
  });

  const chatIds = Object.values(connections).map((chat) => new ObjectId((chat as { chat_id: string }).chat_id));

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
      },
    )
    .toArray();
}

/**
 *
 * @param chatId Chat Id in string
 * @param count Number of messages user has
 * @param messagesCount Number of messages user is requesting
 */
async function getMessages(chatId: string, count = 20, messagesCount = 50) {
  const data = await chatsCollection
    .aggregate([
      {
        $match: {
          _id: new ObjectId(chatId),
        },
      },
      {
        $addFields: {
          messageCount: { $size: "$messages" },
        },
      },
      {
        $addFields: {
          offset: {
            $subtract: ["$messageCount", count],
          },
          pageSize: {
            $min: [{ $subtract: ["$messageCount", count] }, messagesCount],
          },
        },
      },
      {
        $project: {
          _id: 0,
          messages: {
            $slice: ["$messages", { $subtract: ["$offset", "$pageSize"] }, "$pageSize"],
          },
          hasMore: { $gt: ["$offset", "$pageSize"] },
        },
      },
    ])
    .toArray();
  if (!data?.[0]) return {};

  return data[0];
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

async function oAuthGoogleLoginFinder(email: string) {
  const user = await usersCollection.findOne({
    "oauth.google.email": email,
  });
  return user ? user._id : false;
}

async function updateOAuthProfile(userId: string, oauthEmail: string, service: "google") {
  const updateQuery = {
    [service]: {
      enabled: true,
      email: oauthEmail,
    },
  };
  return usersCollection.updateOne(
    {
      _id: new ObjectId(userId),
    },
    {
      $set: {
        oauth: updateQuery,
      },
    },
  );
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
}: {
  about: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  username: string;
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
      key: "",
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
  return usersCollection.updateOne({ _id: new ObjectId(user_id) }, { $set: { "avatar.key": url } });
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
    },
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
    },
  );
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
    },
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
    update,
  );
}

async function updateProfile(
  userId: string,
  {
    firstName,
    lastName = "",
    about = ".",
    email = "",
    username,
  }: { firstName: string; lastName: string; about: string; email: string; username: string },
) {
  return await usersCollection.updateOne(
    {
      _id: new ObjectId(userId),
    },
    {
      $set: {
        firstName,
        lastName,
        about,
        email,
        username,
      },
    },
  );
}

async function clearChat(chat_id: string, from: string, to: string) {
  removeDirectory(`chat_${chat_id}`);
  return await Promise.all([
    chatsCollection.updateOne(
      {
        _id: new ObjectId(chat_id),
      },
      {
        $set: {
          messages: [],
        },
      },
    ),
    usersCollection.updateOne(
      {
        _id: new ObjectId(to),
      },
      {
        $set: {
          [`connections.${from}.unseen_messages_count`]: 0,
        },
      },
    ),
  ]);
}

async function deleteChat(chatId: string, fromId: string, connectionId: string, toBlock = false) {
  removeDirectory(`chat_${chatId}`);
  const updateQuerySender: {
    $unset: object;
    $push?: object;
  } = {
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
          update: { ...updateQuerySender } as any,
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

async function updateStatus(userId: string, { code, update_type }: { code: keyof typeof USER_STATUS; update_type: "auto" | "manual" }) {
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
    update,
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
    },
  );
}

async function isUserRestricted(restrictId: string, userId: string) {
  const result = await Promise.all([
    usersCollection.findOne(
      {
        _id: new ObjectId(userId),
        blocked_users: { $in: [new ObjectId(restrictId)] },
      },
      { projection: { _id: 1 } },
    ),
    usersCollection.findOne(
      {
        _id: new ObjectId(restrictId),
        blocked_users: { $in: [new ObjectId(userId)] },
      },
      { projection: { _id: 1 } },
    ),
  ]);

  return result && (result[0]?._id || result[1]?._id) ? true : false;
}

async function deleteMessage(chatId: string, messageId: string, fromId: string, forAll = false, attachments: string[]) {
  let params: any = [
    {
      _id: new ObjectId(chatId),
      "messages.id": new ObjectId(messageId),
    },
    {
      $addToSet: {
        "messages.$.deletedFor": new ObjectId(fromId),
      },
    },
  ];
  if (forAll) {
    params = [
      {
        _id: new ObjectId(chatId),
      },
      {
        $pull: {
          messages: { id: new ObjectId(messageId), sender_id: fromId },
        },
      },
    ];
    if (attachments) {
      await removeAsset(attachments);
    }
  }
  return chatsCollection.updateOne(params[0], params[1]);
}

async function updateMessage(chatId: string, messageId: string, update: MessageUpdate, fromId: string) {
  return chatsCollection.updateOne(
    {
      _id: new ObjectId(chatId),
    },
    {
      $set: {
        "messages.$[message].text": update.text,
        "messages.$[message].edited": true,
      },
    },
    {
      arrayFilters: [
        {
          "message.id": new ObjectId(messageId),
          "message.sender_id": fromId,
        },
      ],
    },
  );
}

async function getBlockedUsers(userId: string) {
  const data = await usersCollection.findOne({ _id: new ObjectId(userId) }, { projection: { _id: 0, blocked_users: 1 } });
  if (data && data.blocked_users?.length > 0) {
    return await usersCollection
      .find(
        {
          _id: {
            $in: data.blocked_users,
          },
        },
        { projection: ProfileDataProjection },
      )
      .toArray();
  }
  return [];
}

async function blockUser(userId: string, blockId: string) {
  return usersCollection.updateOne(
    {
      _id: new ObjectId(userId),
    },
    {
      $addToSet: {
        blocked_users: new ObjectId(blockId),
      },
    },
  );
}

async function unblockUser(userId: string, blockedId: string) {
  return usersCollection.updateOne(
    {
      _id: new ObjectId(userId),
    },
    {
      $pull: {
        blocked_users: new ObjectId(blockedId),
      },
    },
  );
}

async function provideSignedURL(
  chat_id: string,
  filesInfo: {
    name: string;
    size: number;
  }[],
) {
  const filesWithSignedURL: {
    signed_url: string;
    key: string;
    file_name: string;
  }[] = [];
  for (const file of filesInfo) {
    const fileID = new ObjectId();
    const fileExtension = file.name.match(/\.[0-9a-z]+$/i)?.[0] || "";
    const path = `chat_${chat_id}`;
    const key = `cc_${fileID}${fileExtension}`;
    const url = await getPostSignedURL(`${path}/${key}`, "attachment", 10);
    filesWithSignedURL.push({
      signed_url: url,
      key: `${path}/${key}`,
      file_name: file.name,
    });
  }
  return filesWithSignedURL;
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
  deleteMessage,
  updateMessage,
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
  oAuthGoogleLoginFinder,
  updateOAuthProfile,
  isUserRestricted,
  createNewAccount,
  setProfilePictureUrl,
  findUser,
  updateUnseenMsgCount,
  updateStatus,
  getBlockedUsers,
  blockUser,
  unblockUser,
  getMessages,
  updateProfile,

  // Cloudflare
  provideSignedURL,
};
