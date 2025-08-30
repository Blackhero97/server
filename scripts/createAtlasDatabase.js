// scripts/createAtlasDatabase.js
import "dotenv/config.js";
import mongoose from "mongoose";
import Jeton from "../models/Jeton.js";

async function createAtlasDatabase() {
  try {
    const ATLAS_URL =
      "mongodb+srv://hasanboyleo97_db_user:HSdpeFZO2QpkcgPo@cluster0.4douk7x.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0";

    console.log("📡 Atlas MongoDB-ga ulanmoqda...");
    await mongoose.connect(ATLAS_URL);
    console.log("✅ Atlas ulandi");

    // Test jeton yaratish
    const testJeton = new Jeton({
      code: "TEST-ATLAS-001",
      name: "Atlas Test Jeton",
      isActive: true,
      usageCount: 0,
    });

    await testJeton.save();
    console.log("✅ Test jeton yaratildi:", testJeton.code);

    // Jetonlarni sanash
    const count = await Jeton.countDocuments();
    console.log(`📊 Jami jetonlar: ${count} ta`);

    await mongoose.disconnect();
    console.log("✅ Atlas ulanishi yopildi");
  } catch (error) {
    console.error("❌ Xatolik:", error);
  }
}

createAtlasDatabase();
