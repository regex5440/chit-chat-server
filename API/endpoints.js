const {
  isEmailAlreadyRegistered,
  verifyUser,
} = require("../MongoDB_Helper/index.js");
const { provideOTPAuth, verifyOTPAuth } = require("../utils/2stepauth.js");
const { REGEXP } = require("../utils/enums.js");
const { generateLoginToken, generateNewToken } = require("../utils/jwt.js");
const { SuccessResponse, ErrorResponse } = require("../utils/generator.js");

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

module.exports = { loginAuthentication, emailValidation };
