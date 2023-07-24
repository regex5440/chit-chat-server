import { verifyUser } from "../mongoDBhelper/index.js";
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

//Username Checker
const userNameChecker = (req, res) => {
  setTimeout(() => {
    if (req.query.username && req.query.username === "harshdagar") {
      //TODO: Check available username from the database
      res.send({ available: false });
    } else {
      res.send({ available: true });
    }
  }, 2000);
};

export { loginAuthentication, userNameChecker };
