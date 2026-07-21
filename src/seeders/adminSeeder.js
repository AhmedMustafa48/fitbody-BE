import "dotenv/config";
import mongoose from "mongoose";
import Admin from "../models/Admin.model.js";

const { MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding.");
  process.exit(1);
}

await mongoose.connect(MONGO_URI);

const existing = await Admin.findOne({ email: ADMIN_EMAIL });

if (existing) {
  console.log(`Admin already exists: ${ADMIN_EMAIL}`);
} else {
  await Admin.create({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  console.log(`Admin created: ${ADMIN_EMAIL}`);
}

await mongoose.disconnect();
