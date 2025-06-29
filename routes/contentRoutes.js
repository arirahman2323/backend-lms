const express = require("express");
const multer = require("multer");
const { createContent } = require("../controllers/contentController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Satu endpoint untuk dua jenis konten
router.post("/", protect, adminOnly, upload.array("files"), createContent);

module.exports = router;
