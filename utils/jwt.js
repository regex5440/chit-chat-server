const { config } = require("dotenv");
config();
const jwt = require("jsonwebtoken");
const { setRData, getRData, removeRData } = require("../Redis_Helper");
const { getProfileById } = require("../MongoDB_Helper/index.js");

function generateNewToken(data = {}, type = "login") {
  return jwt.sign(
    data,
    type === "login" ? process.env.TOKEN_KEY : process.env.SIGNUP_TOKEN_KEY,
    {
      expiresIn: type === "login" ? "7d" : "1d",
    }
  );
}

async function generateLoginToken(userId) {
  const token = generateNewToken({ userId });
  const userData = await getProfileById(userId, true);
  if (userData) {
    setRData(
      token,
      JSON.stringify({
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
      })
    );
    return token;
  }
  return "";
}

async function refreshToken(oldToken) {
  const rData = await getRData(oldToken);
  if (rData === null) {
    return false;
  }
  const parsedRData = JSON.parse(rData);
  const newToken = await generateLoginToken(parsedRData.id);
  removeRData(oldToken);
  return newToken;
}

async function validateToken(token, type = "login") {
  return new Promise(async (resolve, reject) => {
    try {
      jwt.verify(
        token,
        type === "login" ? process.env.TOKEN_KEY : process.env.SIGNUP_TOKEN_KEY,
        async function (err, data) {
          if (err) {
            reject(err);
          } else if (type === "login") {
            const rData = await getRData(token);
            if (rData === null) {
              return false;
            }
            const parsedRData = JSON.parse(rData);
            resolve({
              data: parsedRData,
            });
          } else {
            resolve({
              data,
            });
          }
        }
      );
    } catch (e) {
      reject(e);
      console.log("TokenVerifyFailed:", e);
    }
  });
}

module.exports = {
  generateNewToken,
  generateLoginToken,
  validateToken,
  refreshToken,
};
