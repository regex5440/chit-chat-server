import { verifyUser } from "../MongoDB_Helper/index.js";
import { generateNewToken } from "../utils/jwt.js";

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
      let token = generateNewToken({ userId });
      res.status(202).send({ token });
    }
  }
};

//Signup Email authenticator
const emailValidation = async (req, res) => {
  const { emailAddress, code } = req.body;
  if (!req.path.includes("code")) {
    //TODO: Send an OTP Email to email address
    const EmailDoesNotExists_AND_OTPCreated = true;
    if (EmailDoesNotExists_AND_OTPCreated) {
      res.send({ message: "ok", valid: true }); // Email does not already exists and OTP created
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
