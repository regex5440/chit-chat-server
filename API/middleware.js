const { validateToken, refreshToken } = require("../utils/jwt.js");
const { ErrorResponse, SuccessResponse } = require("../utils/generator.js");

const tokenAuthority = async (req, res, next) => {
  const authToken = req.headers.authorization?.split(" ")[1];
  if (authToken) {
    if (/api\/?$/i.test(req.originalUrl)) {
      try {
        const newToken = await refreshToken(authToken);
        if (newToken) {
          res.send(SuccessResponse({ data: newToken }));
        }
      } catch (e) {
        res.send(500);
      } finally {
        return;
      }
    }
    validateToken(authToken, "login")
      .then((data) => {
        req.userId = data.data.id;
        next();
      })
      .catch((r) => {
        res.sendStatus(401);
      });
  } else {
    res.sendStatus(401);
  }
};

const signupTokenAuthority = async (req, res, next) => {
  const authToken = req.headers.authorization?.split(" ")[1];
  if (authToken) {
    validateToken(authToken, "signup")
      .then((data) => {
        req.emailAddress = data.emailAddress;
        next();
      })
      .catch(() => {
        res.status(401).send(ErrorResponse({ message: "Session Expired!" }));
      });
  } else {
    res.sendStatus(401);
  }
};

module.exports = { tokenAuthority, signupTokenAuthority };
