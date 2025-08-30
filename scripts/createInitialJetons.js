// scripts/createInitialJetons.js - 50 ta jeton yaratish
import mongoose from "mongoose";
import "dotenv/config.js";
import Jeton from "../models/Jeton.js";

// MongoDB ga ulanish
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

// 50 ta jeton yaratish
const createInitialJetons = async () => {
  try {
    // Avval mavjud jetonlar sonini tekshirish
    const existingCount = await Jeton.countDocuments();
    console.log(`Mavjud jetonlar soni: ${existingCount}`);

    const jetonsToCreate = [];
    const currentYear = new Date().getFullYear();

    for (let i = 1; i <= 50; i++) {
      const paddedNumber = i.toString().padStart(3, "0");
      const code = `JET-${currentYear}-${paddedNumber}`;

      jetonsToCreate.push({
        code: code,
        child_name: "", // Bo'sh qoldirish, keyinchalik to'ldiriladi
        parent_phone: "",
        isActive: true,
        usageCount: 0,
      });
    }

    // Mavjud kodlarni tekshirish va faqat yangilarini qo'shish
    const newJetons = [];
    for (const jetonData of jetonsToCreate) {
      const existing = await Jeton.findOne({ code: jetonData.code });
      if (!existing) {
        newJetons.push(jetonData);
      } else {
        console.log(`Jeton allaqachon mavjud: ${jetonData.code}`);
      }
    }

    if (newJetons.length > 0) {
      await Jeton.insertMany(newJetons);
      console.log(`${newJetons.length} ta yangi jeton yaratildi ✅`);

      // Yaratilgan jetonlar ro'yxatini ko'rsatish
      console.log("\n=== Yaratilgan jetonlar ===");
      newJetons.forEach((jeton, index) => {
        console.log(`${index + 1}. ${jeton.code}`);
      });
    } else {
      console.log("Barcha jetonlar allaqachon mavjud");
    }

    // Jami jetonlar sonini ko'rsatish
    const totalCount = await Jeton.countDocuments();
    console.log(`\nJami jetonlar soni: ${totalCount}`);
  } catch (error) {
    console.error("Jetonlar yaratishda xatolik:", error);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB ulanishi yopildi");
  }
};

// Scriptni ishga tushirish
const run = async () => {
  await connectDB();
  await createInitialJetons();
};

run().catch(console.error);
