import {
  userProfileData,
  userNameChecker,
  registerUser,
  userSearchHandler,
  blockedUsersRequestHandler,
  blockHandler,
  unblockHandler,
  updateProfileHandler,
  accountDeletionHandler,
  logoutHandler,
} from "./account";
import { emailValidation, loginAuthentication, oAuthHandler, serviceConnectHandler } from "./auth";

import express from "express";

const route = express.Router();

route.get("/dont_sleep", (req, res) => {
  res.status(202).send("Ok, I won't");
});

route.post("/email_verifier", emailValidation);

//After email verification, use this API
route.get("/signup/api/username_checker", userNameChecker);
route.post("/signup/api/register", registerUser);

route.post("/oauth_process", oAuthHandler);

// Login Endpoint
route.post("/login", loginAuthentication);

// Authenticated Login Endpoints
route.get("/api/me", userProfileData);
route.get("/api/findUser", userSearchHandler);
route.get("/api/blocked_users", blockedUsersRequestHandler);
route.get("/api/block", blockHandler);
route.get("/api/unblock", unblockHandler);
route.get("/api/username_checker", userNameChecker);
route.post("/api/update_profile", updateProfileHandler);
route.post("/api/connect_oauth", serviceConnectHandler);
route.post("/api/delete_account", accountDeletionHandler);

route.get("/api/log_out", logoutHandler);

route.get("/", (req, res) => {
  res.redirect(301, "https://cc.hdxdev.in");
});

export default route;
