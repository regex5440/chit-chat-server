const {
  isEmailAlreadyRegistered,
  verifyUser,
} = require("../MongoDB_Helper/index.js");
const { provideOTPAuth, verifyOTPAuth } = require("../utils/2stepauth.js");
const { REGEXP } = require("../utils/enums.js");
const { generateLoginToken, generateNewToken } = require("../utils/jwt.js");

//Login Page
const loginAuthentication = async (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    const { userExists, credentialsMatch, userId } = await verifyUser(
      username,
      password
    );
    if (!userExists) res.send("User does not exists!");
    else if (!credentialsMatch)
      res.send("Username or Password is not correct!");
    else {
      let token = generateLoginToken(userId);
      res.send({ valid: true, token });
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
        res.send({ message: "Invalid Email", valid: false });
        return;
      }
      const emailAlreadyRegistered = await isEmailAlreadyRegistered(
        emailAddress
      );
      if (!emailAlreadyRegistered) {
        const OTPCreated = await provideOTPAuth(emailAddress, resend, req.ip);
        if (OTPCreated.created || OTPCreated.exists) {
          res.send({ message: "ok", valid: true }); // Email does not already exists and OTP created
        } else {
          res.send({ message: OTPCreated.message });
        }
      } else {
        res.send({ message: "Email already exists!", valid: false });
      }
    } else {
      const { valid } = verifyOTPAuth(emailAddress, parseInt(code), req.ip);
      if (valid) {
        res.json({
          token: generateNewToken({ emailAddress }, "signup"),
          verified: true,
        });
      } else {
        res.json({ verified: false });
      }
    }
  } catch (e) {
    res.status(500).send("Something went wrong to us!");
    console.error("FailedEmailAuthentication:", e);
  }
};

module.exports = { loginAuthentication, emailValidation };
