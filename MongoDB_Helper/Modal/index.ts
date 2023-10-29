//@ts-nocheck
import { Schema, model } from "mongoose";

const Profile = model(
  "Profile",
  new Schema({
    // _id: String,
    avatar: {
      url: String,
      key: String,
    },
    connections: {},
    createdAt: Date,
    email: String,
    firstName: String,
    lastName: String,
    last_active: Date,
    profile_type: String,
    username: String,
    status: "ONLINE" | "OFFLINE",
  })
);

const Chat = model(
  "Chat",
  new Schema({
    authors_typing: Array,
    created_at: Date,
    last_updated: Date,
    created_by: String,
    messages: Array,
    participants: Array,
  })
);

export { Profile, Chat };
