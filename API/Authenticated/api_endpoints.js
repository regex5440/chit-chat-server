import {
  connectionsData,
  createNewAccount,
  isUsernameAvailable,
  myProfile,
} from "../../MongoDB_Helper/index.js";
import { generateLoginToken } from "../../utils/jwt.js";

const userProfileData = async (req, res) => {
  console.log(req.userId, "userId");
  try {
    const profileData = await myProfile(req.userId);
    res.json(profileData);
  } catch (e) {
    console.log("/ProfileAPIError:", e);
    res.sendStatus(500);
  }
};

const connectionProfileData = async function (req, res) {
  try {
    const data = await connectionsData(req.userId);
    res.json({
      contacts: data.connections,
      chats: data.chats,
    });
  } catch (e) {
    console.error("/ConnectionsAPIError:", e);
    res.sendStatus(500);
  }
};

//Username Checker
const userNameChecker = (req, res) => {
  try {
    if (req.query?.username) {
      isUsernameAvailable(req.query.username).then((availability) => {
        res.json({
          available: availability,
        });
      });
    } else {
      res.status(400).send("Invalid username check request");
    }
  } catch (e) {
    console.log("FailedUsernameCheck:", e);
    res.status(500).send("Please contact support!");
  }
};

const imageHandler = (req, res) => {
  //TODO: Create a image upload handler
  /*
   * Receive the authenticated request for AWS signed URL
   * Get the signed URL from AWS and send as response
   * AWS will receive the image directly and store it based on authenticated email
   */
};

const registerUser = async (req, res) => {
  console.log("Request Received");
  try {
    if (Object.keys(req.body).length === 5) {
      const { usernameSelected, firstName, lastName, email, password } =
        req.body;
      const usernameAvailable = await isUsernameAvailable(usernameSelected);
      console.log("Username checking");
      if (usernameAvailable) {
        //TODO1: check bucket using email for uploaded image, if available
        //TODO2: after verification, create a account, use mongoDBHelper
        //TODO2.1: Attach the image link from bucket to mongoDB object
        //TODO3 [DONE]: User the userId to generate a login token
        const user = await createNewAccount({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password: email.trim(),
          username: usernameSelected.trim(),
          profile_picture_url: "", // To be updated with image url
        });
        const token = generateLoginToken(user.insertedId);
        res.json({ valid: true, token });
      } else {
        res.send(400);
      }
    } else {
      res.status(401);
    }
  } catch (e) {
    console.error("ErrorRegisterNewUser:", e);
    res.status(500).send("Please contact support!");
  }
};

export {
  connectionProfileData,
  userProfileData,
  userNameChecker,
  imageHandler,
  registerUser,
};
