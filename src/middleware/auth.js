import jwt from "jsonwebtoken";

export const protect = (req, _res, next) => {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) {
    const err = new Error("Not authorized");
    err.statusCode = 401;
    return next(err);
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decoded;
  next();
};
