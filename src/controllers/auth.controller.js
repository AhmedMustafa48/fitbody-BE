import jwt from "jsonwebtoken";
import Admin from "../models/Admin.model.js";

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const err = new Error("Email and password are required");
      err.statusCode = 400;
      return next(err);
    }

    const admin = await Admin.findOne({ email });
    if (!admin || !(await admin.comparePassword(password))) {
      const err = new Error("Invalid credentials");
      err.statusCode = 401;
      return next(err);
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      admin: { id: admin._id, email: admin.email, role: admin.role },
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.user.id).select("-password");
    if (!admin) {
      const err = new Error("Not authorized");
      err.statusCode = 401;
      return next(err);
    }
    res.json({ success: true, admin: { id: admin._id, email: admin.email, role: admin.role } });
  } catch (err) {
    next(err);
  }
};

export const logout = (_req, res) => {
  res.clearCookie("token");
  res.json({ success: true, message: "Logged out" });
};

export const seed = async (req, res, next) => {
  try {
    const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return res.status(400).json({ error: "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env" });
    }
    const existing = await Admin.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      return res.json({ message: `Admin already exists: ${ADMIN_EMAIL}` });
    }
    await Admin.create({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    res.json({ message: `Admin created successfully: ${ADMIN_EMAIL}` });
  } catch (err) {
    next(err);
  }
};
