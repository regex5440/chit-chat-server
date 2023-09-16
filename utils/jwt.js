const { config } = require("dotenv");
config();
const jwt = require("jsonwebtoken");

function generateNewToken(data = {}, type = "login") {
  return jwt.sign(
    data,
    type === "login" ? process.env.TOKEN_KEY : process.env.SIGNUP_TOKEN_KEY,
    {
      expiresIn: type === "login" ? "7d" : "1d",
    }
  );
}

function generateLoginToken(userId) {
  return generateNewToken({ userId });
}

function validateToken(token, callback, type = "login") {
  try {
    jwt.verify(
      token,
      type === "login" ? process.env.TOKEN_KEY : process.env.SIGNUP_TOKEN_KEY,
      function (err, data) {
        if (err) {
          console.error(err);
          callback(false);
        }
        callback(data);
      }
    );
  } catch (e) {
    callback(false);
    console.log("TokenVerifyFailed:", e);
  }
}

module.exports = { generateNewToken, generateLoginToken, validateToken };
