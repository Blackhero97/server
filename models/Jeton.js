import mongoose from "mongoose";

// Jeton kodi validatsiyasi
const validateJetonCode = (code) => {
  // JET- prefiksi bilan boshlangan kodlarni qabul qilish
  const jetonPattern = /^JET-[A-Za-z0-9]+-[A-Za-z0-9]+$/;
  return jetonPattern.test(code) || /^[A-Za-z0-9]{6,20}$/.test(code);
};

const jetonSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator: validateJetonCode,
        message:
          "Jeton kodi noto'g'ri formatda. JET-xxxxxxxx-xxx yoki 6-20 ta harf/raqam bo'lishi kerak",
      },
    }, // Jeton kodi
    name: { type: String, trim: true }, // Jeton nomi (Jeton 1, Jeton 2, ...)
    child_name: { type: String, trim: true }, // Bola ismi (optional, backward compatibility)
    parent_phone: { type: String, trim: true }, // Ota-ona telefon raqami (optional)
    isActive: { type: Boolean, default: true }, // Faol/nofaol holati
    usageCount: { type: Number, default: 0 }, // Necha marta ishlatilgani
    lastUsed: { type: Date }, // Oxirgi ishlatilgan vaqt
  },
  {
    timestamps: true, // createdAt va updatedAt maydonlarini avtomatik qo'shish
  }
);

// Index qo'shish tez qidirish uchun
jetonSchema.index({ code: 1 });
jetonSchema.index({ isActive: 1 });
jetonSchema.index({ createdAt: -1 });

const Jeton = mongoose.model("Jeton", jetonSchema);

export default Jeton;
