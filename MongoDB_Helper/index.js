const { config } = require("dotenv");
config();
const { MongoClient, ObjectId } = require("mongodb");
const {
  ProfileDataProjection,
  ProfileSearchResults,
} = require("./projections.js");

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
async function myProfile(userId) {
  return await usersCollection.findOne(
    { _id: new ObjectId(userId) },
    { projection: { _id: 0, ...ProfileDataProjection } }
  );
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

//?     Connections
async function connectionsData(userId) {
  const { connections } = await usersCollection.findOne(
    { _id: new ObjectId(userId) },
    { projection: { _id: 0, connections: 1 } }
  );

  const contactIds = Object.keys(connections).map((id) => new ObjectId(id));
  const contactsArray = await usersCollection
    .find(
      { _id: { $in: contactIds } },
      {
        projection: {
          _id: 0,
          ...ProfileDataProjection,
        },
      }
    )
    .toArray();

  contactsArray.forEach((contact) => {
    //*  Adding profileData for each connection
    Object.assign(connections[contact.id], contact);
  });

  const chatIds = Object.values(connections).map(
    ({ chat_id }) => new ObjectId(chat_id)
  );

  const chats = await chatsCollection //*  Providing chat data with last 20 messages
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
          messages: { $slice: ["$messages", 0, 20] },
        },
      }
    )
    .toArray();
  return { connections, chats };
}

async function isUsernameAvailable(user_provided_username) {
  const user = await usersCollection.findOne({
    username: user_provided_username,
  });
  return !user ? true : false;
}

async function isEmailAlreadyRegistered(email_address) {
  const user = await usersCollection.findOne({ email: email_address });
  return user ? true : false;
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
        $project: ProfileSearchResults,
      },
    ])
    .toArray();
  return users;
}

async function createNewAccount({
  firstName,
  lastName,
  email,
  password,
  username,
  profile_picture_url,
}) {
  const newUser = await usersCollection.insertOne({
    profile_type: "person",
    firstName,
    lastName,
    status: "ONLINE",
    avatar: {
      url: profile_picture_url,
      key: "",
    },
    last_active: "",
    connections: {},
    email,
    password,
    username,
  });
  console.log(newUser);
  return newUser;
}

async function setProfilePictureUrl(user_id, url) {
  return usersCollection.updateOne(
    { _id: new ObjectId(user_id) },
    { $set: { "avatar.url": url } }
  );
}

module.exports = {
  //MongoDBClient
  mongoDbClient,
  //Collections
  chatsCollection,
  usersCollection,
  // Functions
  myProfile,
  connectionsData,
  verifyUser,
  isUsernameAvailable,
  isEmailAlreadyRegistered,
  createNewAccount,
  setProfilePictureUrl,
  findUser,
};
