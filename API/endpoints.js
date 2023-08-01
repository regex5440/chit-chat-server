import {
  isEmailAlreadyRegistered,
  verifyUser,
} from "../MongoDB_Helper/index.js";
import { REGEXP } from "../utils/enums.js";
import { generateLoginToken, generateNewToken } from "../utils/jwt.js";

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
  const { emailAddress, code } = req.body;
  if (!code) {
    //TODO: Send an OTP Email to email address
    if (!REGEXP.email.test(emailAddress)) {
      res.send({ message: "Invalid Email", valid: false });
      return;
    }
    const emailAlreadyRegistered = await isEmailAlreadyRegistered(emailAddress);
    if (!emailAlreadyRegistered) {
      const OTPCreated = true;
      // TODO: Generate OTP
      if (OTPCreated) {
        res.send({ message: "ok", valid: true }); // Email does not already exists and OTP created
      } else {
        res.status(500).send({ message: "Something went wrong!" });
      }
    } else {
      res.send({ message: "Email already exists!", valid: false });
    }
  } else {
    const approved = code == "123";
    if (approved) {
      res.json({
        token: generateNewToken({ emailAddress }, "signup"),
        verified: true,
      });
    } else {
      res.json({ verified: false });
    }
  }
};

export { loginAuthentication, emailValidation };
