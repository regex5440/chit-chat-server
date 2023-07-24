import { validateToken } from "../utils/jwt.js";

const tokenAuthority = (req, res, next) => {
  const authToken = req.headers.authorization?.split(" ")[1];
  if (authToken) {
    validateToken(authToken, (data) => {
      if (data) {
        console.log(data);
        // throw new Error("I want to stop");
        req.userId = data.userId;
        next();
      } else {
        res.sendStatus(401);
      }
    });
  } else {
    res.sendStatus(401);
  }
};

export { tokenAuthority };
