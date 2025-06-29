const Task = require("../models/Task");
const Group = require("../models/Group");

// @desc    Get all tasks (both Admin & Member see all tasks)
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res) => {
  try {
    const { status } = req.query;

    // 1️⃣  Siapkan filter status (jika ada)
    const filter = {};
    if (status) filter.status = status;

    // 2️⃣  Ambil semua task + populate assignedTo
    let tasks = await Task.find(filter).populate("assignedTo", "name email");

    // 3️⃣  Tambahkan completedTodoCount pada setiap task
    tasks = tasks.map((task) => {
      const completedCount = task.todoChecklist.filter((item) => item.completed).length;
      return {
        ...task.toObject(),
        completedTodoCount: completedCount,
      };
    });

    // 4️⃣  Hitung ringkasan status untuk SEMUA task
    const [allTasks, pendingTasks, inProgressTasks, completedTasks] = await Promise.all([
      Task.countDocuments({}), // total
      Task.countDocuments({ status: "Pending" }),
      Task.countDocuments({ status: "In Progress" }),
      Task.countDocuments({ status: "Completed" }),
    ]);

    // 5️⃣  Kirim respons
    res.json({
      tasks,
      statusSummary: {
        all: allTasks,
        pendingTasks,
        inProgressTasks,
        completedTasks,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { getTasks };

// @desc    Get tasks by type (pretest/postest/regular)
// @route   GET /api/tasks/:type
// @access  Private (Admin or user)
const getTasksByType = async (req, res) => {
  try {
    const { type } = req.params;

    let filter = {};

    if (type === "pretest") {
      filter.isPretest = true;
    } else if (type === "postest") {
      filter.isPostest = true;
    } else if (type === "problem") {
      filter.isProblem = true;
    } else if (type === "regular") {
      filter.isPretest = false;
      filter.isPostest = false;
    } else {
      return res.status(400).json({ message: "Invalid task type. Use pretest or postest" });
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 });

    res.status(200).json({ tasks });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate("assignedTo", "name email profileImageUrl");

    if (task?.problem?.length > 0) {
      // Populate manual group
      const groupIds = task.problem.map((p) => p.groupId).filter(Boolean);
      const groups = await Group.find({ _id: { $in: groupIds } }).lean();

      // Inject data group ke masing-masing problem
      task.problem = task.problem.map((p) => {
        const group = groups.find((g) => g._id.toString() === p.groupId?.toString());
        return { ...p, group };
      });
    }

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Create a new task (Admin only)
// @route   POST /api/tasks/, /api/tasks/pretest, /api/tasks/posttest
// @access  Private (Admin)
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      dueDate,
      assignedTo = [],
      attachments,
      todoChecklist,
      essayQuestions = [],
      multipleChoiceQuestions = [],
      problem = [], // <- ditambahkan
    } = req.body;

    if (!Array.isArray(assignedTo)) {
      return res.status(400).json({ message: "Assigned to must be an array of user IDs" });
    }

    // Detect type from route
    const path = req.route.path; // e.g. '/', '/pretest', '/posttest'
    const isPretest = path === "/pretest";
    const isPostest = path === "/postest";
    const isProblem = path === "/problem";

    const task = await Task.create({
      title,
      description,
      priority,
      dueDate,
      assignedTo,
      createdBy: req.user._id,
      attachments,
      todoChecklist,
      essayQuestions,
      multipleChoiceQuestions,
      isPretest,
      isPostest,
      isProblem,
      problem,
    });

    const updatedProblem = await Promise.all(
      task.problem.map(async (p, index) => {
        const group = await Group.create({
          name: `${title} - Problem ${index + 1}`,
          members: [...assignedTo, req.user._id],
          taskId: task._id,
          problemId: p._id, // ✅ DITAMBAHKAN
        });

        return {
          ...p.toObject(),
          groupId: group._id,
        };
      })
    );

    task.problem = updatedProblem;
    await task.save();

    res.status(201).json({ message: "Task created successfully", task });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update task details
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if ("title" in req.body) task.title = req.body.title;
    if ("description" in req.body) task.description = req.body.description;
    if ("priority" in req.body) task.priority = req.body.priority;
    if ("dueDate" in req.body) task.dueDate = req.body.dueDate;
    if ("todoChecklist" in req.body) task.todoChecklist = req.body.todoChecklist;
    if ("attachments" in req.body) task.attachments = req.body.attachments;
    if ("problem" in req.body) task.problem = req.body.problem;

    if ("assignedTo" in req.body) {
      if (!Array.isArray(req.body.assignedTo)) {
        return res.status(400).json({ message: "assignedTo must be an array of user IDs" });
      }
      task.assignedTo = req.body.assignedTo;
    }

    const updatedTask = await task.save();
    res.json({ message: "Task updated successfully", task: updatedTask });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
  console.log("Updated Title:", task.title);
};

// @desc    Update only questions of a task (Admin only)
// @route   PUT /api/tasks/pretest/:id, /api/tasks/posttest/:id
// @access  Private (Admin)
const updateTaskQuestionsOnly = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const { essayQuestions, multipleChoiceQuestions, problem, title, description, dueDate } = req.body;

    const path = req.route.path;
    const isPretest = path.includes("/pretest");
    const isPostest = path.includes("/postest");
    const isProblem = path.includes("/problem");

    if (isPretest && !task.isPretest) {
      return res.status(400).json({ message: "This task is not marked as a pretest" });
    }

    if (isPostest && !task.isPostest) {
      return res.status(400).json({ message: "This task is not marked as a postest" });
    }

    if (isProblem && !task.isProblem) {
      return res.status(400).json({ message: "This task is not marked as a problem" });
    }

    if (essayQuestions !== undefined) {
      task.essayQuestions = essayQuestions;
    }

    if (multipleChoiceQuestions !== undefined) {
      task.multipleChoiceQuestions = multipleChoiceQuestions;
    }

    if (problem !== undefined) {
      task.problem = problem;
    }

    if (title !== undefined) {
      task.title = title;
    }

    if (description !== undefined) {
      task.description = description;
    }

    if (dueDate !== undefined) {
      task.dueDate = dueDate;
    }

    const updatedTask = await task.save();
    res.json({ message: "Questions updated successfully", task: updatedTask });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc Delete task (admin only)
// @route DELETE /api/tasks/:id
// @access Private (Admin)
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    await task.deleteOne();
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc Delete specific question from a task
// @route DELETE /api/tasks/:taskId/questions/:questionId?type=essay|multipleChoice
// @access Private (Admin)
const deleteTaskQuestions = async (req, res) => {
  try {
    const { taskId, questionId } = req.params;
    const { type } = req.query;

    if (!type || !["essay", "multipleChoice"].includes(type)) {
      return res.status(400).json({
        message: "Query parameter 'type' must be 'essay' or 'multipleChoice'",
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (type === "essay") {
      task.essayQuestions = task.essayQuestions.filter((q) => q._id.toString() !== questionId);
    } else {
      task.multipleChoiceQuestions = task.multipleChoiceQuestions.filter((q) => q._id.toString() !== questionId);
    }

    await task.save();

    res.json({ message: `${type} question deleted successfully.` });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update task status
// @route   PUT /api/tasks/:id/status
// @access  Private
const updateTaskStatus = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.status = req.body.status || task.status;

    if (task.status === "Completed") {
      task.todoChecklist.forEach((item) => (item.completed = true));
      task.progress = 100;
    }

    await task.save();
    res.json({ message: "Task status updated", task });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update task checklist
// @route   PUT /api/tasks/:id/todo
// @access  Private
const updateTaskChecklist = async (req, res) => {
  try {
    const { todoChecklist } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });

    if (!task.assignedTo.includes(req.user._id) && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to update checklist" });
    }

    task.todoChecklist = todoChecklist; // Replace with updated checklist

    // Auto-update progress based on checklist completion
    const completedCount = task.todoChecklist.filter((item) => item.completed).length;
    const totalItems = task.todoChecklist.length;

    task.progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

    // Auto-mark task as completed if all items are checked
    if (task.progress === 100) {
      task.status = "Completed";
    } else if (task.progress > 0) {
      task.status = "In Progress";
    } else {
      task.status = "Pending";
    }

    await task.save();
    const updatedTask = await Task.findById(req.params.id).populate("assignedTo", "name email profileImageUrl");

    res.json({ message: "Task checklist updated", task: updatedTask });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get dashboard data (Admin: all tasks, User: assigned tasks)
// @route   GET /api/tasks/dashboard-data
// @access  Private
const getDashboardData = async (req, res) => {
  try {
    // Fetch statistics
    const totalTasks = await Task.countDocuments();
    const pendingTasks = await Task.countDocuments({ status: "Pending" });
    const completedTasks = await Task.countDocuments({ status: "Completed" });
    const overdueTasks = await Task.countDocuments({
      status: { $ne: "Completed" },
      dueDate: { $lt: new Date() },
    });

    // Ensure all possible statuses are included
    const taskStatuses = ["Pending", "In Progress", "Completed"];
    const taskDistributionRaw = await Task.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Format task distribution
    const taskDistribution = taskStatuses.reduce((acc, status) => {
      const formattedKey = status.replace(/\s+/g, ""); // Remove spaces for response keys
      acc[formattedKey] = taskDistributionRaw.find((item) => item._id === status)?.count || 0;
      return acc;
    }, {});
    taskDistribution["All"] = totalTasks; // Add total count to taskDistribution

    // Ensure all priority levels are included
    const taskPriorities = ["Low", "Medium", "High"];
    const taskPriorityLevelsRaw = await Task.aggregate([
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    const taskPriorityLevels = taskPriorities.reduce((acc, priority) => {
      acc[priority] = taskPriorityLevelsRaw.find((item) => item._id === priority)?.count || 0;
      return acc;
    }, {});

    // Fetch recent 10 Tasks
    const recentTasks = await Task.find().sort({ createdAt: -1 }).limit(10).select("title status priority dueDate CreatedAt");
    res.status(200).json({
      statistics: {
        totalTasks,
        pendingTasks,
        completedTasks,
        overdueTasks,
      },
      charts: {
        taskDistribution,
        taskPriorityLevels,
      },
      recentTasks,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get user dashboard data (User: assigned tasks)
// @route   GET /api/tasks/user-dashboard-data
// @access  Private
const getUserDashboardData = async (req, res) => {
  try {
    const userId = req.user._id; // Only fetch data for the logged-in user

    // Fetch statistics for user-specific tasks
    const totalTasks = await Task.countDocuments({ assignedTo: userId });
    const pendingTasks = await Task.countDocuments({ assignedTo: userId, status: "Pending" });
    const completedTasks = await Task.countDocuments({ assignedTo: userId, status: "Completed" });
    const overdueTasks = await Task.countDocuments({
      assignedTo: userId,
      status: { $ne: "Completed" },
      dueDate: { $lt: new Date() },
    });

    // Task distribution by status
    const taskStatuses = ["Pending", "In Progress", "Completed"];
    const taskDistributionRaw = await Task.aggregate([{ $match: { assignedTo: userId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]);

    const taskDistribution = taskStatuses.reduce((acc, status) => {
      const formattedKey = status.replace(/\s+/g, "");
      acc[formattedKey] = taskDistributionRaw.find((item) => item._id === status)?.count || 0;
      return acc;
    }, {});

    taskDistribution["All"] = totalTasks;

    // task distribution by priority
    const taskPriorities = ["Low", "Medium", "High"];
    const taskPriorityLevelsRaw = await Task.aggregate([{ $match: { assignedTo: userId } }, { $group: { _id: "$priority", count: { $sum: 1 } } }]);

    const taskPriorityLevels = taskPriorities.reduce((acc, priority) => {
      acc[priority] = taskPriorityLevelsRaw.find((item) => item._id === priority)?.count || 0;
      return acc;
    }, {});

    // fetch recent 10 tasks for the loggin in user
    const recentTasks = await Task.find({ assignedTo: userId }).sort({ createdAt: -1 }).limit(10).select("title status priority dueDate CreatedAt");

    res.status(200).json({
      statistics: {
        totalTasks,
        pendingTasks,
        completedTasks,
        overdueTasks,
      },
      charts: {
        taskDistribution,
        taskPriorityLevels,
      },
      recentTasks,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskChecklist,
  getDashboardData,
  getUserDashboardData,
  getTasksByType,
  updateTaskQuestionsOnly,
  deleteTaskQuestions,
};
