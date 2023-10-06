const {
  isEmailAlreadyRegistered,
  verifyUser,
} = require("../MongoDB_Helper/index.js");
const { provideOTPAuth, verifyOTPAuth } = require("../utils/2stepauth.js");
const { REGEXP } = require("../utils/enums.js");
const { generateLoginToken, generateNewToken } = require("../utils/jwt.js");
const { SuccessResponse, ErrorResponse } = require("../utils/generator.js");
const { OAuth2Client } = require("google-auth-library");

//Login Page
const loginAuthentication = async (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    const { userExists, credentialsMatch, userId } = await verifyUser(
      username,
      password
    );
    if (!userExists)
      res.send(ErrorResponse({ message: "User does not exists!" }));
    else if (!credentialsMatch)
      res.send(
        ErrorResponse({ message: "Username or Password is not correct!" })
      );
    else {
      let token = generateLoginToken(userId);
      res.send(SuccessResponse({ data: token }));
    }
  }
  res.status(400).json(ErrorResponse({ message: "Invalid credentials input" }));
};

//Signup Email authenticator
const emailValidation = async (req, res) => {
  try {
    const { emailAddress, code, resend } = req.body;
    if (!code) {
      if (!REGEXP.email.test(emailAddress)) {
        // INVALID EMAIL
        res.send(ErrorResponse({ message: "Invalid Email" }));
        return;
      }
      const emailAlreadyRegistered = await isEmailAlreadyRegistered(
        emailAddress
      );
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
          })
        );
      } else {
        res.send(ErrorResponse({ message: "Unverified" }));
      }
    }
  } catch (e) {
    res
      .status(500)
      .send(ErrorResponse({ message: "Something went wrong to us!" }));
    console.error("FailedEmailAuthentication:", e);
  }
};

// Google Signin handler
const oAuthHandler = async (req, res) => {
  const credential = req.body?.credential || undefined;
  if (credential) {
    try {
      const client = new OAuth2Client();
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.OAuth_ID,
      });
      const payload = ticket.getPayload();
      const registeredUser = await isEmailAlreadyRegistered(payload.email);
      if (registeredUser) {
        res.send(
          SuccessResponse({
            data: generateLoginToken(registeredUser),
            message: "login",
          })
        );
      } else {
        res.send(
          SuccessResponse({
            data: {
              emailVerified: payload.email_verified,
              firstName: payload.given_name,
              lastName: payload.family_name,
              email: payload.email,
              token: payload.email_verified
                ? generateNewToken({ emailAddress: payload.email }, "signup")
                : null,
            },
            message: "signup",
          })
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
module.exports = { loginAuthentication, emailValidation, oAuthHandler };
