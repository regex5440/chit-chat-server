import { config } from "dotenv";
config();
import * as jwt from "jsonwebtoken";
import { setRData, getRData, removeRData } from "../Redis_Helper";
import { getProfileById } from "../MongoDB_Helper";

type TokenData_LOGIN = { userId: string };
type TokenData_SIGNUP = { emailAddress: string };
type RedisLoginData = {
  id: string,
  username: string,
  firstName: string,
  lastName: string,
}

function generateNewToken(data = {}, type: 'login' | "signup" = "login") {
  if (process.env.TOKEN_KEY === undefined || process.env.SIGNUP_TOKEN_KEY === undefined) throw new Error("Token key not found");
  return jwt.sign(
    data,
    type === "login" ? process.env.TOKEN_KEY : process.env.SIGNUP_TOKEN_KEY,
    {
      expiresIn: type === "login" ? "7d" : "1d",
    }
  );
}

async function generateLoginToken(userId: string): Promise<string> {
  const token = generateNewToken({ userId });
  const userData = await getProfileById(userId, true);
  if (userData) {
    setRData(
      token,
      JSON.stringify({
        id: userData.id,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
      })
    );
    return token;
  }
  return "";
}

async function refreshToken(oldToken: string) {
  const rData = await getRData(oldToken);
  if (rData === null) {
    return false;
  }
  const parsedRData = JSON.parse(rData);
  const newToken = await generateLoginToken(parsedRData.id);
  removeRData(oldToken);
  return newToken;
}

type SessionType = 'login' | 'signup';
type ValidTokenResponse<T> = Promise<T extends "login" ? RedisLoginData : TokenData_SIGNUP>;
async function validateToken<T extends SessionType>(token: string, type: T): ValidTokenResponse<T> {
  return new Promise(async (resolve, reject) => {
    try {
      if (process.env.TOKEN_KEY === undefined || process.env.SIGNUP_TOKEN_KEY === undefined) {
        reject("Token key not found");
        throw new Error("Token key not found");
      }
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
            const parsedRData: RedisLoginData = JSON.parse(rData);
            resolve(parsedRData as unknown as ValidTokenResponse<T>);
          } else if (type === 'signup') {
            resolve(data as ValidTokenResponse<T>);
          }
        }
      );
    } catch (e) {
      reject(e);
      console.log("TokenVerifyFailed:", e);
    }
  });
}

export { generateNewToken, generateLoginToken, validateToken, refreshToken };
