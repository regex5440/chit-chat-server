const {
  connectionsData,
  createNewAccount,
  isUsernameAvailable,
  myProfile,
  setProfilePictureUrl,
  findUser,
} = require("../../MongoDB_Helper/index.js");
const { generateLoginToken } = require("../../utils/jwt.js");
const { uploadProfileImage } = require("../../CloudFlare_Helper/index.js");

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

const userSearchHandler = async (req, res) => {
  try {
    if (req.query.q?.length === 0) {
      res.status(400).send("Invalid request");
      return;
    }
    const users = await findUser(req.query.q);
    //TODO: Add group search
    res.json({
      success: true,
      data: { users, hasData: users.length > 0, groups: [] },
    });
  } catch (e) {
    console.log(e);
    res.status(500).json("Something went wrong!");
  }
};

const imageHandler = async (req, res) => {
  const imageBlob = req.body;
  if (!imageBlob) {
    res.status(400).send("Image not provided!");
  }
  const data = await uploadProfileImage(req.userId, imageBlob);
  console.log(data);
  if (data) {
    await setProfilePictureUrl(req.userId, data.Key);
  }
  res.send("ok");
};

const registerUser = async (req, res) => {
  try {
    if (Object.keys(req.body).length === 5) {
      const { usernameSelected, firstName, lastName, email, password } =
        req.body;
      const usernameAvailable = await isUsernameAvailable(usernameSelected);
      if (usernameAvailable && email === req.emailAddress) {
        const user = await createNewAccount({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password: password.trim(),
          username: usernameSelected.trim(),
          profile_picture_url: "", // To be updated with image url
        });
        const token = generateLoginToken(user.insertedId);
        res.json({ valid: true, token });
      }
    }
    res.status(400).send(); // Bad requests for Invalid requests
  } catch (e) {
    console.error("ErrorRegisterNewUser:", e);
    res.status(500).send("Please contact support!");
  }
};

module.exports = {
  connectionProfileData,
  userProfileData,
  userNameChecker,
  imageHandler,
  registerUser,
  userSearchHandler,
};
