import { validateToken, refreshToken } from "@lib/jwt";
import { ErrorResponse, SuccessResponse } from "@utils/generator";
import { MiddleWare } from "@types";

const tokenAuthority: MiddleWare = async (req, res, next) => {
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
      }
      return;
    }

    validateToken(authToken, "login")
      .then((data) => {
        req.userId = data.id;
        next();
      })
      .catch((r) => {
        res.status(401).send(r);
      });
  } else {
    res.sendStatus(401);
  }
};

const signupTokenAuthority: MiddleWare = async (req, res, next) => {
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

export { tokenAuthority, signupTokenAuthority };
