import { config } from "dotenv";
config();
import { MongoClient } from "mongodb";

export const mongoDbClient = new MongoClient(
  `mongodb+srv://${process.env.DB_UserName}:${encodeURIComponent(
    process.env.DB_PassWord || "",
  )}@cluster0.qsbznrs.mongodb.net/?retryWrites=true&w=majority`,
);

const db = mongoDbClient.db("chit-chat");

export default db;