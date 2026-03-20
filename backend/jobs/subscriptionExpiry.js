// ============================================================
//  SDUCS – MK  |  Subscription Expiry Job
// ============================================================
const User = require("../models/User");

async function expireSubscriptions() {
  try {
    const expired = await User.find({
      "subscription.expiresAt": { $lte: new Date() },
      "subscription.plan": { $ne: "none" },
    });

    if (!expired.length) return;

    for (const user of expired) {
      user.subscription.plan = "none";
      user.subscription.dataGB = 0;
      await user.save();
    }

    console.log(`🔄 Expired ${expired.length} subscriptions.`);
  } catch (err) {
    console.error("Subscription expiry error:", err);
  }
}

module.exports = { expireSubscriptions };
