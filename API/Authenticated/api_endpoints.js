import { connectionsData, myProfile } from "../../mongoDBhelper/index.js";

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

export { connectionProfileData, userProfileData };
