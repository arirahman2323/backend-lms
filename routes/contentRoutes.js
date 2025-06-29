const express = require("express");
const multer = require("multer");
const { createContent, getContents, getContentsByType, deleteContent, updateContent } = require("../controllers/contentController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const { get } = require("mongoose");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Satu endpoint untuk dua jenis konten
router.post("/", protect, adminOnly, upload.array("files"), createContent);

router.put("/:id", protect, adminOnly, upload.array("files"), updateContent);
router.delete("/:id", protect, adminOnly, deleteContent);

router.get("/", protect, getContents);
router.get("/:type", protect, getContentsByType);
module.exports = router;
