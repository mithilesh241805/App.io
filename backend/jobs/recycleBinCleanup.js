// ============================================================
//  SDUCS – MK  |  Recycle Bin Cleanup Job
// ============================================================
const File = require("../models/File");
const User = require("../models/User");
const { deleteFromStorage } = require("../utils/storage");

async function cleanupRecycleBin() {
  try {
    const now = new Date();
    const expired = await File.find({
      isDeleted: true,
      permanentDeleteAt: { $lte: now },
    });

    if (!expired.length) {
      console.log("🗑️  No expired recycle bin items.");
      return;
    }

    let deleted = 0;
    let errors = 0;
    const userSizeMap = {};

    for (const file of expired) {
      try {
        await deleteFromStorage(file.storageKey);
        userSizeMap[file.ownerId] = (userSizeMap[file.ownerId] || 0) + file.sizeBytes;
        await file.deleteOne();
        deleted++;
      } catch (err) {
        console.error(`Failed to delete file ${file._id}:`, err.message);
        errors++;
      }
    }

    // Update user storage
    for (const [uid, bytes] of Object.entries(userSizeMap)) {
      await User.findOneAndUpdate(
        { uid },
        { $inc: { "cloudStorage.usedBytes": -bytes } }
      );
    }

    console.log(`🗑️  Recycle bin cleanup: ${deleted} deleted, ${errors} errors`);
  } catch (err) {
    console.error("Recycle bin cleanup error:", err);
  }
}

module.exports = { cleanupRecycleBin };
