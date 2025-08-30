// models/History.js
import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      index: true,
    },
    token_code: { type: String, index: true },
    entry_time: { type: Date, required: true },
    exit_time: { type: Date },
    paid_amount: { type: Number, default: 0 },
    
    // 🆕 Jeton ma'lumotlari
    jeton_name: { type: String, trim: true },
    jeton_tariff: { type: String, enum: ["standard", "vip"] },
  },
  { timestamps: true }
);

export default mongoose.model("History", historySchema);
