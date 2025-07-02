const express = require("express");
const { createContent, 
    getContents, 
    getContentsByType, 
    deleteContent, 
    updateContent, 
    updateContentStatus,
    deleteContentFilesOnly } = require("../controllers/contentController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

const router = express.Router();

// Satu endpoint untuk dua jenis konten
router.post("/", protect, adminOnly, upload.array("files"), createContent);

router.put("/:id", protect, adminOnly, upload.array("files"), updateContent);
router.put("/:id/status", protect, updateContentStatus);
router.delete("/:id", protect, adminOnly, deleteContent);
router.delete("/:id/files/:filename", protect, adminOnly, deleteContentFilesOnly);

router.get("/", protect, getContents);
router.get("/:type", protect, getContentsByType);
module.exports = router;
