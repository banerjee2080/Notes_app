import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { isTokenRevoked } from "../lib/tokenBlacklist.js";

export const ProtectedRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    if (!token)
      return res.status(401).json({ message: "Invalid - No token provided" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    
    if (!decoded) return res.status(401).json({ message: "Invalid token" });

    // Checked after verify so forged/expired tokens never cost a network call.
    // If Redis errors we fall through to the 500 below (fail closed) rather
    // than letting a possibly-revoked token through.
    if (await isTokenRevoked(token, decoded)) {
      return res
        .status(401)
        .json({ message: "Token has been revoked. Please log in again." });
    }

    const user = await User.findById(decoded.userId).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found!" });

    req.user = user;
    next();
  } catch (error) {
    console.log("Error in protectedRoute: ", error);
    res.status(500).json("Internal Server Error");
  }
};
