import { ObjectId, UpdateFilter } from "mongodb";
import db from "../db/client";
import { ProfileDataProjection, ProfileSearchResults, UserProfileProjection } from "../db/schema/projections";
import { USER_STATUS } from "../utils/enums";
import { MessageObject } from "../../@types";
import { createNewChat } from "./chat";

const usersCollection = db.collection("users");

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

async function verifyUser(usernameOrEmail: string, password: string) {
  const user = await usersCollection.findOne({
    $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
  });
  const result = { userExists: false, credentialsMatch: false, userId: "" };
  if (user && user.deleted !== true) {
    result.userExists = true;
    if (user.password === password) {
      result.credentialsMatch = true;
      result.userId = user._id.toString();
    }
  }
  return result;
}

//     Connections Data for initial request
async function getConnectionsData(userId: string) {
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

  contactsArray.forEach((contact) => {
    //*  Adding profileData for each connection
    delete contact.unseen_messages_count;
    Object.assign(connections[contact.id], contact);
  });


  return connections;
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
    "oAuth.google.email": email,
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
        oAuth: updateQuery,
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
        $match: {
          deleted: { $ne: true },
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
  oAuth = { email: "", service: "google" },
}: {
  about: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  username: string;
  oAuth?: {
    service: "google";
    email: string;
  };
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
    oAuth: {
      [oAuth.service]: {
        enabled: oAuth?.email ? true : false,
        email: oAuth?.email || "",
      },
    },
  });
  console.log(newUser);
  return newUser;
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

async function clearChatMessageCount(from: string, to: string) {
  return usersCollection.updateOne(
      {
        _id: new ObjectId(to),
      },
      {
        $set: {
          [`connections.${from}.unseen_messages_count`]: 0,
        },
      },
    );
}

async function deleteChatConnections(fromId: string, connectionId: string, toBlock = false) {
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
async function deleteAccount(userId: string) {
  return usersCollection.updateOne(
    {
      _id: new ObjectId(userId),
    },
    {
      $unset: {
        username: "",
        email: "",
        password: "",
        avatar: {
          url: "",
          key: "",
        },
        about: "",
        connections: {},
        blocked_ids: [],
        status: USER_STATUS.OFFLINE,
        oAuth: {
          google: {
            enabled: false,
            email: "",
          },
        },
        last_active: "",
      },
      $set: {
        deleted: true,
        deleted_at: new Date(),
        firstName: "Deleted",
        lastName: "User",
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


export {
    getProfileById,
    getConnectionData,
    verifyUser,
    getConnectionsData,
    isUsernameAvailable,
    isEmailAlreadyRegistered,
    oAuthGoogleLoginFinder,
    updateOAuthProfile,
    findUser,
    createNewAccount,
    setProfilePictureUrl,
    addConnection,
    updateUnseenMsgCount,
    updateProfile,
    clearChatMessageCount,
    deleteChatConnections,
    updateStatus,
    isUserRestricted,
    getBlockedUsers,
    blockUser,
    deleteAccount,
    unblockUser,
}