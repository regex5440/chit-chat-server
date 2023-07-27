import { validateToken } from "../utils/jwt.js";

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
          req.emailToken = data.emailAddress;
          next();
        } else {
          res.sendStatus(401);
        }
      },
      "signup"
    );
  } else {
    res.sendStatus(401);
  }
};

export { tokenAuthority, signupTokenAuthority };
