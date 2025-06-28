// 📁 routes/mindmapRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  createMindmapTask,
  submitMindmapAnswer,
  giveMindmapScore,
  updateMindmapTask,
  deleteMindmapTask,
  getAllMindmapTasks,
  getMindmapTaskById,
  getSubmissionsByTask,
  getMySubmission,
  getAllSubmissions,
} = require("../controllers/mindmapController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

const upload = multer({ dest: "uploads/" });

/* ──────────────── ADMIN ──────────────── */
router.post("/", protect, adminOnly, upload.array("rubricFiles"), createMindmapTask);
router.put("/:id", protect, adminOnly, upload.array("rubricFiles"), updateMindmapTask);
router.delete("/:id", protect, adminOnly, deleteMindmapTask);
router.patch("/:id/score", protect, adminOnly, giveMindmapScore);
router.get("/:taskId/submissions", protect, adminOnly, getSubmissionsByTask);
router.get("/submissions", protect, adminOnly, getAllSubmissions);

/* ──────────────── USER ──────────────── */
router.post("/:taskId/submit", protect, upload.single("pdf"), submitMindmapAnswer);
router.get("/:taskId/mysubmission", protect, getMySubmission);

/* ──────────────── COMMON ──────────────── */
router.get("/", protect, getAllMindmapTasks);
router.get("/:id", protect, getMindmapTaskById);

module.exports = router;
