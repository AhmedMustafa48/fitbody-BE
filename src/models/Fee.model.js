import mongoose from "mongoose";

const feeSchema = new mongoose.Schema(
  {
    member:    { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    amount:    { type: Number, required: true, min: 0 },
    remaining: { type: Number, default: 0, min: 0 },
    dueDate:   { type: Date, required: true },
    paidDate:  { type: Date },
    status:    { type: String, enum: ["paid", "unpaid", "overdue"], default: "unpaid" },
    method:    { type: String, enum: ["cash", "online", "card"] },
    note:      { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Fee", feeSchema);
