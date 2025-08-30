// scripts/updateSampleJetons.js - Ba'zi jetonga bola ismi qo'shish
import mongoose from "mongoose";
import "dotenv/config.js";
import Jeton from "../models/Jeton.js";

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kids-crm"
    );
    console.log("MongoDB ga ulandi ✅");
  } catch (error) {
    console.error("MongoDB xatolik:", error);
    process.exit(1);
  }
};

const sampleUpdates = [
  {
    code: "JET-2025-001",
    child_name: "Ali Karimov",
    parent_phone: "+998901234567",
  },
  {
    code: "JET-2025-002",
    child_name: "Malika Tosheva",
    parent_phone: "+998902345678",
  },
  {
    code: "JET-2025-003",
    child_name: "Sardor Usmonov",
    parent_phone: "+998903456789",
  },
  {
    code: "JET-2025-004",
    child_name: "Zarina Alimova",
    parent_phone: "+998904567890",
  },
  {
    code: "JET-2025-005",
    child_name: "Dilshod Rahmonov",
    parent_phone: "+998905678901",
  },
  {
    code: "JET-2025-006",
    child_name: "Madina Qodirova",
    parent_phone: "+998906789012",
  },
  {
    code: "JET-2025-007",
    child_name: "Javohir Mirzaev",
    parent_phone: "+998907890123",
  },
  {
    code: "JET-2025-008",
    child_name: "Gulnoza Shermatova",
    parent_phone: "+998908901234",
  },
  {
    code: "JET-2025-009",
    child_name: "Aziz Nematov",
    parent_phone: "+998909012345",
  },
  {
    code: "JET-2025-010",
    child_name: "Dilfuza Hayitova",
    parent_phone: "+998900123456",
  },
];

const updateSampleJetons = async () => {
  try {
    console.log("Ba'zi jetonlarga ma'lumot qo'shilmoqda...");

    for (const update of sampleUpdates) {
      await Jeton.findOneAndUpdate(
        { code: update.code },
        {
          child_name: update.child_name,
          parent_phone: update.parent_phone,
        },
        { new: true }
      );
      console.log(`✅ ${update.code} - ${update.child_name} yangilandi`);
    }

    console.log(
      `\n${sampleUpdates.length} ta jeton ma'lumotlari yangilandi ✅`
    );
  } catch (error) {
    console.error("Jetonlarni yangilashda xatolik:", error);
  } finally {
    await mongoose.connection.close();
  }
};

const run = async () => {
  await connectDB();
  await updateSampleJetons();
};

run().catch(console.error);
