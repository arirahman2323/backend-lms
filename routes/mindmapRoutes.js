const express = require("express");
const router = express.Router();
const upload = require("../middlewares/uploadMiddleware");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

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
  updateMindmapStatus,
  getSubmissionsByUser,
} = require("../controllers/mindmapController");

/* ──────────────── ADMIN ──────────────── */

// Create or update mindmap task (with rubricFiles upload)
router.post("/", protect, adminOnly, upload.array("rubricFiles"), createMindmapTask);
router.put("/:id", protect, adminOnly, upload.array("rubricFiles"), updateMindmapTask);

// Delete and update task status/score
router.delete("/:id", protect, adminOnly, deleteMindmapTask);
router.put("/:id/status", protect, updateMindmapStatus);
router.patch("/:id/score", protect, adminOnly, giveMindmapScore);

// Get submissions (should come before `/:id`)
router.get("/submissions", protect, adminOnly, getAllSubmissions);
router.get("/:taskId/submissions", protect, getSubmissionsByTask);
router.get("/submissions/:userId", protect, adminOnly, getSubmissionsByUser);

/* ──────────────── USER ──────────────── */

// User submits answer (PDF only)
router.post("/:taskId/submit", protect, upload.single("pdf"), submitMindmapAnswer);
router.get("/:taskId/mysubmission", protect, getMySubmission);

/* ──────────────── COMMON ──────────────── */

// Get all mindmap tasks or by ID
router.get("/", protect, getAllMindmapTasks);
router.get("/:id", protect, getMindmapTaskById);

module.exports = router;
