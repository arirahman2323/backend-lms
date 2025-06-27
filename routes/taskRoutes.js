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
    deleteTaskQuestions 
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

router.delete('/:taskId/questions/:questionId', protect, deleteTaskQuestions);
module.exports = router;
