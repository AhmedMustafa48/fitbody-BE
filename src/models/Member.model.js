import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    memberId:          { type: String, required: true, unique: true, trim: true },
    fullName:          { type: String, required: true, trim: true },
    phone:             { type: String, required: true, trim: true },
    cnic:              { type: String, unique: true, sparse: true, trim: true },
    gender:            { type: String, enum: ["male", "female", "other"], required: true },
    shift:             { type: String, enum: ["morning", "evening"], required: true },
    age:               { type: Number, required: true, min: 1 },
    address:           { type: String, trim: true },
    admissionFees:     { type: Number, min: 0 },
    fees:              { type: Number, required: true, min: 0 },
    feesAfterDiscount: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    joinDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.model("Member", memberSchema);
