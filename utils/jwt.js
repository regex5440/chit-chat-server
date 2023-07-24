import { config } from "dotenv";
config();
import jwt from "jsonwebtoken";

function generateNewToken(data = {}) {
  return jwt.sign(data, process.env.TOKEN_KEY, {
    expiresIn: "7d",
  });
}

function validateToken(token, callback) {
  jwt.verify(token, process.env.TOKEN_KEY, function (err, data) {
    if (err) {
      console.error(err);
      callback(false);
    }
    callback(data);
  });
}

export { generateNewToken, validateToken };
