import {
  userProfileData,
  userNameChecker,
  registerUser,
  userSearchHandler,
  blockedUsersRequestHandler,
  blockHandler,
  unblockHandler,
} from "../API/Authenticated/endpoint_handler";
import { emailValidation, loginAuthentication, oAuthHandler } from "../API/endpoint_handler";
import { removeRData } from "../Redis_Helper";

import express from "express";

const route = express.Router();

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

route.get("/api/log_out", async (req, res) => {
  if (req.headers.authorization) {
    await removeRData(req.headers.authorization.split(" ")?.[1]);
    res.send("ok");
  }
  res.status(401).send();
});

route.get("/", (req, res) => {
  res.redirect(301, "https://cc.hdxdev.in");
});

export default route;
