import { config } from "dotenv";
config();
import jwt from "jsonwebtoken";

function generateNewToken(data = {}, type = "signup") {
  return jwt.sign(
    data,
    type === "login" ? process.env.TOKEN_KEY : process.env.SIGNUP_TOKEN_KEY,
    {
      expiresIn: type === "login" ? "7d" : "1d",
    }
  );
}

function validateToken(token, callback, type = "login") {
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
}

export { generateNewToken, validateToken };
