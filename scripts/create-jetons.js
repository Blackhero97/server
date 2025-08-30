// 50 ta jeton yaratish script
import mongoose from "mongoose";
import "dotenv/config.js";
import Jeton from "../models/Jeton.js";

const createJetons = async () => {
  try {
    // MongoDB ga ulanish
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/kids-crm"
    );
    console.log("MongoDB ulandi ✅");

    // Avvalgi jetonlarni tozalash
    await Jeton.deleteMany({});
    console.log("Eski jetonlar tozalandi");

    // 50 ta jeton yaratish
    const jetons = [];
    const childNames = [
      "Aziz",
      "Bobur",
      "Davron",
      "Eldor",
      "Farid",
      "Gulnor",
      "Hamid",
      "Iroda",
      "Jasur",
      "Kamron",
      "Laziz",
      "Madina",
      "Nilufar",
      "Oybek",
      "Parviz",
      "Qodira",
      "Rustam",
      "Sarvar",
      "Temur",
      "Umida",
      "Valida",
      "Webber",
      "Xurshid",
      "Yulduz",
      "Zarina",
      "Aziza",
      "Bekzod",
      "Charos",
      "Diyor",
      "Erkin",
      "Farida",
      "Guzal",
      "Husan",
      "Inobat",
      "Jahon",
      "Komil",
      "Lola",
      "Mehroj",
      "Nasiba",
      "Oydin",
      "Patima",
      "Quvonch",
      "Rohila",
      "Sabina",
      "Tohir",
      "Ulug'bek",
      "Vohida",
      "Xasan",
      "Yoqbon",
      "Zamira",
    ];

    for (let i = 0; i < 50; i++) {
      const timestamp = (Date.now() + i).toString().slice(-8);
      const random = (i + 100).toString().padStart(3, "0");
      const code = `JET-${timestamp}-${random}`;

      jetons.push({
        code: code,
        child_name: childNames[i],
        parent_phone: `+9989${(10000000 + i).toString().slice(-8)}`,
        isActive: true,
        usageCount: 0,
      });
    }

    // Barcha jetonlarni saqlash
    await Jeton.insertMany(jetons);
    console.log(`✅ ${jetons.length} ta jeton yaratildi!`);

    // Ba'zi jetonlarni ko'rsatish
    console.log("\nYaratilgan jetonlardan ba'zilari:");
    jetons.slice(0, 5).forEach((jeton, index) => {
      console.log(`${index + 1}. ${jeton.code} - ${jeton.child_name}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Xatolik:", error);
    process.exit(1);
  }
};

createJetons();
