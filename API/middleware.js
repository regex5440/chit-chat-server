const { validateToken } = require("../utils/jwt.js");

const tokenAuthority = (req, res, next) => {
  const authToken = req.headers.authorization?.split(" ")[1];
  if (authToken) {
    validateToken(
      authToken,
      (data) => {
        if (data) {
          req.userId = data.userId;
          next();
        } else {
          res.sendStatus(401);
        }
      },
      "login"
    );
  } else {
    res.sendStatus(401);
  }
};

const signupTokenAuthority = (req, res, next) => {
  const authToken = req.headers.authorization?.split(" ")[1];
  if (authToken) {
    validateToken(
      authToken,
      (data) => {
        if (data) {
          req.emailAddress = data.emailAddress;
          next();
        } else {
          res.status(401).send({ message: "Session Expired!" });
        }
      },
      "signup"
    );
  } else {
    res.sendStatus(401);
  }
};

module.exports = { tokenAuthority, signupTokenAuthority };
