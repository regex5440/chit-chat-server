import {
  connectionsData,
  isUsernameAvailable,
  myProfile,
} from "../../MongoDB_Helper/index.js";

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

export {
  connectionProfileData,
  userProfileData,
  userNameChecker,
  imageHandler,
};
