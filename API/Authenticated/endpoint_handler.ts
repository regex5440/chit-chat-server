import {
  createNewAccount,
  isUsernameAvailable,
  setProfilePictureUrl,
  findUser,
  getProfileById,
  blockUser,
  unblockUser,
  getBlockedUsers,
  updateProfile,
  updateOAuthProfile,
} from "../../MongoDB_Helper";
import { generateLoginToken } from "../../utils/jwt";
import { getPostSignedURL, uploadProfileImage } from "../../CloudFlare_Helper";
import { ErrorResponse, SuccessResponse } from "../../utils/generator";
import { RequestHandler } from "../../@types";
import { OAuth2Client } from "google-auth-library";

const userProfileData: RequestHandler = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).send(ErrorResponse({ message: "Unauthorized" }));
    const profileData = await getProfileById(req.userId, true);
    res.send(SuccessResponse({ data: profileData }));
  } catch (e) {
    console.log("/ProfileAPIError:", e);
    res.sendStatus(500);
  }
};

//Username Checker
const userNameChecker: RequestHandler = (req, res) => {
  try {
    if (req.query?.username) {
      isUsernameAvailable(req.query.username as string).then((availability) => {
        res.send(
          SuccessResponse({
            data: { available: availability },
          }),
        );
      });
    } else {
      res.status(400).send(ErrorResponse({ message: "Invalid username check request" }));
    }
  } catch (e) {
    console.log("FailedUsernameCheck:", e);
    res.status(500).send(ErrorResponse({ message: "Please contact support!" }));
  }
};

const blockedUsersRequestHandler: RequestHandler = async (req, res) => {
  try {
    if (req.userId) {
      const blockedUsers = await getBlockedUsers(req.userId);
      res.send(SuccessResponse({ data: blockedUsers }));
      return;
    }
    res.status(400).send(ErrorResponse({ message: "Invalid request" }));
  } catch (e) {
    console.log(e);
    res.status(500).send(ErrorResponse({ message: "Something went wrong!" }));
  }
};

const blockHandler: RequestHandler = async (req, res) => {
  try {
    if (req.userId && req.query?.id) {
      await blockUser(req.userId, req.query.id as string);
      res.send(SuccessResponse({ message: "ok", data: req.query.id }));
      return;
    }
    res.status(400).send(ErrorResponse({ message: "Invalid request" }));
  } catch (e) {
    console.log(e);
    res.status(500).send(ErrorResponse({ message: "Something went wrong!" }));
  }
};

const unblockHandler: RequestHandler = async (req, res) => {
  try {
    if (req.userId && req.query?.id) {
      await unblockUser(req.userId, req.query.id as string);
      res.send(SuccessResponse({ message: "ok", data: req.query.id }));
      return;
    }
    res.status(400).send(ErrorResponse({ message: "Invalid request" }));
  } catch (e) {
    console.log(e);
    res.status(500).send(ErrorResponse({ message: "Something went wrong!" }));
  }
};

const updateProfileHandler: RequestHandler = async (req, res) => {
  try {
    if (req.userId && req.body) {
      const { about, firstName, lastName, username, email } = req.body;
      if (firstName && username) {
        await updateProfile(req.userId, { about, firstName, lastName, username, email });
        res.send(SuccessResponse({ message: "ok" }));
      } else {
        res.status(400).send(ErrorResponse({ message: "First name and username are mandatory fields!" }));
      }
    }
  } catch (e) {
    console.log(e);
    res.status(500).send(ErrorResponse({ message: "Something went wrong!" }));
  }
};

const serviceConnectHandler: RequestHandler = async (req, res) => {
  try {
    if (req.userId && req.body) {
      const { service, credential } = req.body;
      if (service && credential) {
        const client = new OAuth2Client();
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.OAuth_ID,
        });
        const payload = ticket.getPayload();
        if (payload?.email === undefined) throw new Error("No data from Google");
        await updateOAuthProfile(req.userId, payload.email, service);
        res.send(SuccessResponse({ message: "added", data: { service, email: payload.email } }));
      } else {
        res.status(400).send(ErrorResponse({ message: "Invalid data provided" }));
      }
    }
  } catch (e) {
    console.log(e);
    res.status(500).send(ErrorResponse({ message: "Something went wrong!" }));
  }
};

const userSearchHandler: RequestHandler = async (req, res) => {
  try {
    if (req.query.q?.length === 0) {
      res.status(400).send(ErrorResponse({ message: "Invalid request" }));
      return;
    }
    const users = await findUser(req.query.q as string);
    for (const i in users) {
      if (users[i].blocked_users?.includes(req.userId)) {
        users[i].restricted = true;
      }
      delete users[i].blocked_users;
    }
    //TODO: Add group search
    res.send(
      SuccessResponse({
        data: { users, hasData: users.length > 0, groups: [] },
      }),
    );
  } catch (e) {
    console.log(e);
    res.status(500).send(ErrorResponse({ message: "Something went wrong!" }));
  }
};

const registerUser: RequestHandler = async (req, res) => {
  try {
    console.log(Object.keys(req.body).length);
    if (Object.keys(req.body).length === 7) {
      const { about, usernameSelected, firstName, lastName, email, password, hasImage } = req.body;
      const usernameAvailable = await isUsernameAvailable(usernameSelected);
      if (usernameAvailable && email === req.emailAddress) {
        const user = await createNewAccount({
          about: about.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password: password.trim(),
          username: usernameSelected.trim(),
        });
        const generatedUserId = user.insertedId.toString();
        const token = await generateLoginToken(generatedUserId);
        if (hasImage) {
          const signedURL = await getPostSignedURL(`${generatedUserId}.png`, "profileImage");
          setProfilePictureUrl(generatedUserId, `${generatedUserId}.png`);
          res.send(SuccessResponse({ data: { token, signedURL } }));
        } else {
          res.send(SuccessResponse({ data: token }));
        }
      }
    }
    res.status(400).send(); // Bad requests for Invalid requests
  } catch (e) {
    console.error("ErrorRegisterNewUser:", e);
    res.status(500).send(ErrorResponse({ message: "Please contact support!" }));
  }
};

export {
  userProfileData,
  userNameChecker,
  registerUser,
  userSearchHandler,
  blockedUsersRequestHandler,
  blockHandler,
  unblockHandler,
  updateProfileHandler,
  serviceConnectHandler,
};
