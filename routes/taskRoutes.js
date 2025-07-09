const express = require("express");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const {
  getDashboardData,
  getUserDashboardData,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskChecklist,
  getTasksByType,
  updateTaskQuestionsOnly,
  deleteTaskQuestions,
  getFullTaskSubmissionsByUser,
  downloadEportfolioAsPdf,
} = require("../controllers/taskController");

const router = express.Router();

router.get("/full-submissions/:userId", protect, getFullTaskSubmissionsByUser);
router.get("/eportfolio/:userId/download", protect, downloadEportfolioAsPdf);
// Dashboard routes
router.get("/dashboard-data", protect, getDashboardData);
router.get("/user-dashboard-data", protect, getUserDashboardData);

// Task fetching
router.get("/", protect, getTasks);
router.get("/:id", protect, getTaskById);

// Task modification
router.put("/:id", protect, updateTask);
router.delete("/:id", protect, adminOnly, deleteTask);
router.put("/:id/status", protect, updateTaskStatus);
router.put("/:id/todo", protect, updateTaskChecklist);

// Create task by type
router.post("/pretest", protect, createTask);
router.post("/postest", protect, createTask);
router.post("/problem", protect, createTask);
router.post("/refleksi", protect, createTask); // ✅ Ditambahkan
router.post("/lo", protect, createTask); // ✅ Ditambahkan
router.post("/kbk", protect, createTask); // ✅ Ditambahkan

// Update task questions only
router.put("/pretest/:id", protect, updateTaskQuestionsOnly);
router.put("/posttest/:id", protect, updateTaskQuestionsOnly);
router.put("/problem/:id", protect, updateTaskQuestionsOnly);
router.put("/refleksi/:id", protect, updateTaskQuestionsOnly);
router.put("/lo/:id", protect, updateTaskQuestionsOnly);
router.put("/kbk/:id", protect, updateTaskQuestionsOnly);

// Filter task by type
router.get("/type/:type", protect, getTasksByType);

// Get chat group info for a specific problem
router.get("/:taskId/problem/:problemId/group", protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const problemItem = task.problem.find((p) => p._id.toString() === req.params.problemId);
    if (!problemItem || !problemItem.groupId) {
      return res.status(404).json({ message: "Group for this problem not found" });
    }

    const group = await Group.findById(problemItem.groupId).populate("members", "name email profileImageUrl");
    if (!group) return res.status(404).json({ message: "Group not found" });

    res.json(group);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete question from task
router.delete("/:taskId/questions/:questionId", protect, deleteTaskQuestions);

module.exports = router;
