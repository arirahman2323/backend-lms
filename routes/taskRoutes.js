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
} = require("../controllers/taskController");

const router = express.Router();

// Task Management Routes
router.get("/dashboard-data", protect, getDashboardData);
router.get("/user-dashboard-data", protect, getUserDashboardData);
router.get("/", protect, getTasks); // Get all tasks (Admin: all, User: assigned)
router.get("/:id", protect, getTaskById); // Get task by ID

router.put("/:id", protect, updateTask); // Update task details
router.delete("/:id", protect, adminOnly, deleteTask); // Delete a task (Admin only)
router.put("/:id/status", protect, updateTaskStatus); // Update task status
router.put("/:id/todo", protect, updateTaskChecklist); // Update task checklist

router.post("/pretest", protect, createTask); // Create a new pretest task
router.post("/postest", protect, createTask); // Create a new posttest task
router.post("/problem", protect, createTask); // Create a new problem task
router.get("/type/:type", protect, getTasksByType);

router.put("/pretest/:id", protect, updateTaskQuestionsOnly);
router.put("/posttest/:id", protect, updateTaskQuestionsOnly);
router.put("/problem/:id", protect, updateTaskQuestionsOnly);

// Get chat group info for a specific problem in task
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

router.delete("/:taskId/questions/:questionId", protect, deleteTaskQuestions);
module.exports = router;
