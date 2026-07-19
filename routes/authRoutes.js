const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// ================= AUTH =================
router.post("/register", authController.register);

router.post("/login", authController.login);

router.post(
  "/save-fcm-token",
  authMiddleware.verifyToken,
  authController.saveFcmToken,
);
// ================= PROFILE LOGIN =================
router.get("/profile", authController.getProfile);
module.exports = router;
