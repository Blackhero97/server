// controllers/historyController.js
import History from "../models/History.js";
import Child from "../models/Child.js";

/**
 * Bugungi (yoki ?date=YYYY-MM-DD) hisobot
 */
export const getDailyReport = async (req, res) => {
  try {
    const dateStr = req.query.date; // 'YYYY-MM-DD'
    const base = dateStr ? new Date(dateStr) : new Date();

    // Kun chegaralari (server lokal vaqtiga ko‘ra)
    const start = new Date(base);
    start.setHours(0, 0, 0, 0);
    const end = new Date(base);
    end.setHours(23, 59, 59, 999);

    const sessions = await History.find({
      $or: [
        { entry_time: { $gte: start, $lte: end } },
        { exit_time: { $gte: start, $lte: end } },
      ],
    }).sort({ entry_time: -1 });

    const totalRevenue = sessions.reduce(
      (sum, s) => sum + (s.paid_amount || 0),
      0
    );
    const totalSessions = sessions.length;
    const completed = sessions.filter((s) => !!s.exit_time).length;
    const active = totalSessions - completed;

    res.json({
      date: start.toISOString().slice(0, 10),
      totalRevenue,
      totalSessions,
      completed,
      active,
      sessions,
    });
  } catch (err) {
    console.error("❌ getDailyReport xato:", err.message);
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
};

/**
 * Eski Child sessiyalarini History'ga ko‘chirish (bir martalik migratsiya)
 * ⚠️ Admin-only endpoint sifatida ishlating.
 */
export const backfillHistory = async (_req, res) => {
  try {
    const children = await Child.find({});
    let created = 0,
      updated = 0;

    for (const c of children) {
      const exist = await History.findOne({ sessionId: c._id });

      if (!exist) {
        await History.create({
          sessionId: c._id,
          token_code: c.token_code || null, // checkoutdan keyin null bo‘lishi mumkin
          entry_time: c.entry_time,
          exit_time: c.exit_time,
          paid_amount: c.paid_amount || 0,
        });
        created++;
      } else {
        // mavjud bo‘lsa ham yakuniy qiymatlarni sinxronlab qo‘yamiz
        const upd = await History.updateOne(
          { _id: exist._id },
          {
            $set: {
              exit_time: c.exit_time || exist.exit_time,
              paid_amount:
                typeof c.paid_amount === "number"
                  ? c.paid_amount
                  : exist.paid_amount,
            },
          }
        );
        if (upd.modifiedCount) updated++;
      }
    }

    res.json({ ok: true, created, updated, totalScanned: children.length });
  } catch (err) {
    console.error("❌ backfillHistory xato:", err.message);
    res.status(500).json({ error: "Server xatosi: " + err.message });
  }
};
