import { isEmailAlreadyRegistered, oAuthGoogleLoginFinder, updateOAuthProfile, verifyUser } from "../controllers";
import { provideOTPAuth, verifyOTPAuth } from "../utils/2-step-auth";
import { REGEXP } from "../utils/enums";
import { generateLoginToken, generateNewToken } from "../utils/library/jwt";
import { SuccessResponse, ErrorResponse } from "../utils/generator";
import { RequestHandler } from "../../@types";
import verifyGoogleToken from "../utils/library/oauth";

//Login Page
const loginAuthentication: RequestHandler = async (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    const { userExists, credentialsMatch, userId } = await verifyUser(username, password);
    if (!userExists) res.send(ErrorResponse({ message: "User does not exists!" }));
    else if (!credentialsMatch) res.send(ErrorResponse({ message: "Username or Password is not correct!" }));
    else {
      const token = await generateLoginToken(userId.toString());
      if (token) {
        res.send(SuccessResponse({ data: token }));
      } else {
        res.send(ErrorResponse({ message: "Cannot login!" }));
      }
    }
  } else {
    res.status(400).json(ErrorResponse({ message: "Invalid credentials input" }));
  }
};

//Signup Email authenticator
const emailValidation: RequestHandler = async (req, res) => {
  try {
    if (!req.ip) return;
    const { emailAddress, code, resend } = req.body;
    if (!code) {
      if (!REGEXP.email.test(emailAddress)) {
        // INVALID EMAIL
        res.send(ErrorResponse({ message: "Invalid Email" }));
        return;
      }
      const emailAlreadyRegistered = await isEmailAlreadyRegistered(emailAddress);
      if (!emailAlreadyRegistered) {
        const OTPCreated = await provideOTPAuth(emailAddress, resend, req.ip);
        if (OTPCreated.created || OTPCreated.exists) {
          res.send(SuccessResponse({ message: "ok" })); // Email does not already exists and OTP created
        } else {
          res.send(ErrorResponse({ message: OTPCreated.message }));
        }
      } else {
        res.send(ErrorResponse({ message: "Email already exists!" }));
      }
    } else {
      const { valid } = verifyOTPAuth(emailAddress, parseInt(code), req.ip);
      if (valid) {
        res.send(
          SuccessResponse({
            data: generateNewToken({ emailAddress }, "signup"),
          }),
        );
      } else {
        res.send(ErrorResponse({ message: "Unverified" }));
      }
    }
  } catch (e) {
    res.status(500).send(ErrorResponse({ message: "Something went wrong to us!" }));
    console.error("FailedEmailAuthentication:", e);
  }
};

// Google Signin handler
const oAuthHandler: RequestHandler = async (req, res) => {
  const credential = req.body?.credential || undefined;
  if (credential) {
    try {
      const ticket = await verifyGoogleToken(credential);
      const payload = ticket.getPayload();
      if (payload?.email === undefined) throw new Error("No data from Google");
      const registeredUser = await oAuthGoogleLoginFinder(payload.email);
      if (registeredUser) {
        res.send(
          SuccessResponse({
            data: await generateLoginToken(registeredUser.toString()),
            message: "login",
          }),
        );
      } else {
        res.send(
          SuccessResponse({
            data: {
              emailVerified: payload.email_verified,
              firstName: payload.given_name,
              lastName: payload.family_name,
              email: payload.email,
              token: payload.email_verified ? generateNewToken({ emailAddress: payload.email }, "signup") : null,
            },
            message: "signup",
          }),
        );
      }
    } catch (e) {
      console.log("OAuthFailed", e);
      res.status(500).send(ErrorResponse({ message: "Something went wrong!" }));
    }
  } else {
    res.status(400).send(ErrorResponse({ message: "Invalid data" }));
  }
};

const serviceConnectHandler: RequestHandler = async (req, res) => {
  try {
    if (req.userId && req.body) {
      const { service, credential } = req.body;
      if (service && credential) {
        const ticket = await verifyGoogleToken(credential);
        const payload = ticket.getPayload();
        if (payload?.email === undefined) {
          res.send(ErrorResponse({ message: "No data from Google" }));
        } else {
          const registeredUser = await oAuthGoogleLoginFinder(payload.email);
          if (registeredUser) {
            res.send(ErrorResponse({ message: "Already connected to an account" }));
          } else {
            await updateOAuthProfile(req.userId, payload.email, service);
            res.send(SuccessResponse({ message: "added", data: { service, email: payload.email } }));
          }
        }
      } else {
        res.status(400).send(ErrorResponse({ message: "Invalid data provided" }));
      }
    }
  } catch (e) {
    console.log(e);
    res.status(500).send(ErrorResponse({ message: "Something went wrong!" }));
  }
};

export { loginAuthentication, emailValidation, oAuthHandler, serviceConnectHandler };