import { Schema, model } from "mongoose";

const profileSchema = model(
  "Profile",
  new Schema({
    avatar: {
      url: String,
    },
    connections: Object,
    createdAt: Date | String,
    email: String,
    firstName: String,
    lastName: String,
    last_active: Date | String,
    profile_type: "person",
    username: String,
    status: "ONLINE" | "OFFLINE",
  })
);

export { profileSchema };
