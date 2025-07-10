const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");
const fs = require("fs/promises");
const path = require("path");

const User = require("../models/User");
const Task = require("../models/Task");
const TaskSubmission = require("../models/TaskSubmission");
const Group = require("../models/Group");
const MindmapTask = require("../models/MindmapTask");
const MindmapSubmission = require("../models/MindmapSubmission");
const Content = require("../models/Content");
const Survei = require("../models/Survei");

const { options } = require("../routes/contentRoutes");

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
    } else if (type === "refleksi") {
      filter.isRefleksi = true;
    } else if (type === "lo") {
      filter.isLo = true;
    } else if (type === "kbk") {
      filter.isKbk = true;
    } else if (type === "regular") {
      filter.isPretest = false;
      filter.isPostest = false;
    } else {
      return res.status(400).json({ message: "Invalid task type. Use pretest, postest, problem, refleksi, lo or kbk" });
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
    const { title, description, priority, dueDate, assignedTo = [], attachments, todoChecklist, essayQuestions = [], multipleChoiceQuestions = [], problem = [] } = req.body;

    // Validasi assignedTo harus array
    if (!Array.isArray(assignedTo)) {
      return res.status(400).json({ message: "Assigned to must be an array of user IDs" });
    }

    // Deteksi type berdasarkan path
    const path = req.route.path;
    const isPretest = path === "/pretest";
    const isPostest = path === "/postest";
    const isProblem = path === "/problem";
    const isRefleksi = path === "/refleksi";
    const isLo = path === "/lo";
    const isKbk = path === "/kbk";

    // Untuk LO/KBK, buang correctAnswer dari soal pilihan ganda
    let processedMCQ = multipleChoiceQuestions;
    if (isLo || isKbk) {
      processedMCQ = multipleChoiceQuestions.map((q) => ({
        question: q.question,
        options: q.options,
      }));
    }

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
      multipleChoiceQuestions: processedMCQ,
      problem,
      isPretest,
      isPostest,
      isProblem,
      isRefleksi,
      isLo,
      isKbk,
    });

    // Jika ada problem, buatkan group untuk masing-masing
    const updatedProblem = await Promise.all(
      task.problem.map(async (p, index) => {
        const group = await Group.create({
          name: `${title} - Problem ${index + 1}`,
          members: [...assignedTo, req.user._id],
          taskId: task._id,
          problemId: p._id,
        });

        return {
          ...p.toObject(),
          groupId: group._id,
        };
      })
    );

    // Update task dengan groupId pada problem
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
    const isRefleksi = path === "/refleksi";
    const isLo = path === "/lo";
    const isKbk = path === "/kbk";

    if (isPretest && !task.isPretest) {
      return res.status(400).json({ message: "This task is not marked as a pretest" });
    }

    if (isPostest && !task.isPostest) {
      return res.status(400).json({ message: "This task is not marked as a postest" });
    }

    if (isProblem && !task.isProblem) {
      return res.status(400).json({ message: "This task is not marked as a problem" });
    }

    if (isRefleksi && !task.isRefleksi) {
      return res.status(400).json({ message: "This task is not marked as a refleksi" });
    }

    if (isLo && !task.isLo) {
      return res.status(400).json({ message: "This task is not marked as a LO" });
    }

    if (isKbk && !task.isKbk) {
      return res.status(400).json({ message: "This task is not marked as a KBK" });
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

// get all full tasks submission

const getFullTaskSubmissionsByUser = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Ambil semua konten yang dibuat oleh user (kalau applicable)
    const contents = await Content.find({ createdBy: userId }).lean();

    // Ambil semua survei yang dibuat atau dijawab user
    const surveis = await Survei.find({ user: userId }).lean();

    // Ambil semua tugas biasa
    const tasks = await Task.find().populate("createdBy", "name email").lean();

    // Ambil semua submissions ke Task oleh user
    const taskSubmissions = await TaskSubmission.find({ user: userId }).populate("task", "title essayQuestions multipleChoiceQuestions problem").lean();

    // Format tugas
    const formattedTasks = tasks.map((task) => ({
      _id: task._id,
      title: task.title,
      type: task.isPretest ? "pretest" : task.isPostest ? "postest" : task.isProblem ? "problem" : task.isRefleksi ? "refleksi" : task.isLo ? "lo" : task.isKbk ? "kbk" : "general",
      essayQuestions: task.essayQuestions || [],
      multipleChoiceQuestions: task.multipleChoiceQuestions || [],
      problem: task.problem || [],
    }));

    // Ambil semua mindmap task
    const mindmapTasks = await MindmapTask.find().populate("createdBy", "name email").lean();

    // Ambil submission mindmap oleh user
    const mindmapSubmissions = await MindmapSubmission.find({ user: userId }).populate("task", "instructions rubric").lean();

    const formattedMindmaps = mindmapSubmissions.map((sub) => ({
      taskId: sub.task._id,
      type: "mindmap",
      instructions: sub.task.instructions,
      rubric: sub.task.rubric,
      answerPdf: sub.answerPdf,
      score: sub.score,
      submittedAt: sub.createdAt,
    }));

    res.json({
      userId,
      contents,
      surveis,
      essayTasks: formattedTasks,
      taskSubmissions,
      mindmapTasks,
      mindmapSubmissions: formattedMindmaps,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const createEportfolioHtml = (user, submissions, mindmaps, averageScore, allTaskSubmissions = [], mindmapSubmissions = []) => {
  let scoreTableRows = "";
  [...submissions, ...mindmaps].forEach((item, idx) => {
    scoreTableRows += `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.task?.title || item.type}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.score || 0}</td>
      </tr>
    `;
  });

  const coverBackgroundUrl = `${process.env.API_BASE_URL}/public/cover-background.jpg`;
  const profilePicUrl = `${process.env.API_BASE_URL}/public/avatar.png`;

  // Render soal dan jawaban
  let taskAnswersHtml = "";
  allTaskSubmissions.forEach((submission, idx) => {
    const taskTitle = submission.task?.title || `Tugas ${idx + 1}`;
    taskAnswersHtml += `
      <div style="margin-bottom: 40px;">
        <h3 style="font-size: 20px; margin-bottom: 10px;">${taskTitle}</h3>
    `;

    // Essay
    (submission.task?.essayQuestions || []).forEach((q, i) => {
      const answer = submission.essayAnswers?.find((ea) => ea.questionId.toString() === q._id.toString());
      taskAnswersHtml += `
        <p><strong>- Essay ${i + 1}:</strong> <em>${q.question}</em></p>
        <p style="margin-left: 20px;">Jawaban: ${answer?.answer || "Belum dijawab"}</p>
      `;
    });

    // Multiple Choice
    (submission.task?.multipleChoiceQuestions || []).forEach((q, i) => {
      const answer = submission.multipleChoiceAnswers?.find((mc) => mc.questionId.toString() === q._id.toString());
      taskAnswersHtml += `
        <p><strong>- Pilihan Ganda ${i + 1}:</strong> <em>${q.question}</em></p>
        <p style="margin-left: 20px;">Jawaban: ${answer?.selectedOption || "Belum dijawab"}</p>
      `;
    });

    // Problem
    (submission.task?.problem || [])
      .filter((p) => submission.problemAnswer?.some((pa) => pa.questionId.toString() === p._id.toString()))
      .forEach((p) => {
        const answer = submission.problemAnswer?.find((pa) => pa.questionId.toString() === p._id.toString());

        const originalIndex = (submission.task?.problem || []).findIndex((orig) => orig._id.toString() === p._id.toString());

        taskAnswersHtml += `
      <p><strong>- Problem Kelompok ${originalIndex + 1}:</strong> <em>${p.problem || "(Soal belum tersedia)"}</em></p>
      <p style="margin-left: 20px;">Jawaban: ${answer?.problem || "Belum dijawab"}</p>
    `;
      });

    // File feedback info
    if (submission.feedbackFile) {
      taskAnswersHtml += `
        <p style="margin-top: 10px; font-style: italic; color: gray;">[File Feedback PDF tersedia di halaman terakhir]</p>
      `;
    }

    taskAnswersHtml += `</div>`;
  });

  // Mindmap
  let mindmapHtml = "";
  mindmapSubmissions.forEach((mindmap, idx) => {
    mindmapHtml += `
      <div style="margin-bottom: 40px;">
        <h3 style="font-size: 20px;">${mindmap.task?.title || `Mindmap`}</h3>
        <p><strong>- Instruksi:</strong> ${mindmap.task?.instructions}</p>
        <p><strong>- Rubrik:</strong></p>
        <ul>
          ${(mindmap.task?.rubric || []).map((r) => `<li>${r.text}</li>`).join("")}
        </ul>
        <p style="font-style: italic; color: gray;">[Jawaban PDF tersedia di halaman terakhir]</p>
      </div>
    `;
  });

  return `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; }
          .page { page-break-before: always; padding: 0 40px 0 40px; }
          .cover-page {
            width: 100vw;
            height: 100vh;
            background-image: url('${coverBackgroundUrl}');
            background-size: cover;
            background-position: center;
            position: relative;
          }
          .cover-content {
            position: absolute;
            top: 69.5%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            padding: 20px;
            text-align: center;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .profile-pic {
            width: 120px;
            height: 120px;
            border-radius: 10px;
            object-fit: cover;
            border: 4px solid white;
            background-color: #a1aebf;
          }
          .user-details {
            text-align: center; 
            margin-left: 50px;
          }
          .user-details h2 {
            margin: 0;
            margin-top: 15px;
            font-size: 24px;
          }
          .user-details p {
            margin: 8px 0;
            font-size: 18px;
          }
          @page :first {
            margin: 0;
          }
          @page {
            margin-top: 2cm;
            margin-bottom: 2cm;
          }
        </style>
      </head>
      <body>
        <div class="cover-page">
          <div class="cover-content">
            <img 
              src="${user.profileImageUrl || profilePicUrl}" 
              alt="Profile" 
              class="profile-pic"
            >
            <div class="user-details">
              <h2>${user.name}</h2>
              <p>${user.nim}</p>
              <p>${user.offering}</p>
            </div>
          </div>
        </div>

        <div class="page">
          <h2>Rekapitulasi Nilai</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f2f2f2;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">No</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tugas</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Skor</th>
              </tr>
            </thead>
            <tbody>
              ${scoreTableRows}
              <tr style="font-weight: bold;">
                <td colspan="2" style="border: 1px solid #ddd; padding: 8px; text-align: center;">Rata-rata</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${averageScore}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="page">
          <h2>Detail Jawaban</h2>
          <div>
            ${taskAnswersHtml}
            ${mindmapHtml}
          </div>
        </div>

      </body>
    </html>
  `;
};

const downloadEportfolioAsPdf = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Ambil data user
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    // Ambil semua submission tugas dan populate detail soal
    const submissions = await TaskSubmission.find({ user: userId }).populate("task", "title essayQuestions multipleChoiceQuestions problem").lean();

    // Ambil semua submission mindmap
    const mindmapSubmissions = await MindmapSubmission.find({ user: userId }).populate("task", "title instructions rubric").lean();

    const scores = [...submissions, ...mindmapSubmissions].map((item) => item.score).filter((s) => typeof s === "number");
    const averageScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0;

    // Buat HTML
    const htmlContent = createEportfolioHtml(
      user,
      submissions,
      mindmapSubmissions,
      averageScore,
      submissions, // ini allTaskSubmissions
      mindmapSubmissions
    );

    // Convert HTML ke PDF
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const mainPdfBytes = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    // Gabung PDF dengan feedback dan mindmap
    const mergedPdf = await PDFDocument.create();
    const mainPdfDoc = await PDFDocument.load(mainPdfBytes);
    const copiedMainPages = await mergedPdf.copyPages(mainPdfDoc, mainPdfDoc.getPageIndices());
    copiedMainPages.forEach((page) => mergedPdf.addPage(page));

    const fileUrlsToMerge = [];
    submissions.forEach((sub) => sub.feedbackFile && fileUrlsToMerge.push(sub.feedbackFile));
    mindmapSubmissions.forEach((sub) => {
      sub.rubric?.forEach((r) => r.file && fileUrlsToMerge.push(r.file));
      if (sub.answerPdf) fileUrlsToMerge.push(sub.answerPdf);
    });

    for (const fileUrl of fileUrlsToMerge) {
      try {
        const decodedPathname = decodeURIComponent(new URL(fileUrl).pathname);
        const filename = path.basename(decodedPathname);
        const localPath = path.join(__dirname, "..", "uploads", filename);

        const fileBytes = await fs.readFile(localPath);
        const pdfToMerge = await PDFDocument.load(fileBytes);
        const copiedPages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        console.warn(`Gagal membaca file ${fileUrl}: ${err.message}`);
      }
    }

    const mergedPdfBytes = await mergedPdf.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="E-Portfolio - ${user.name}.pdf"`);
    res.send(Buffer.from(mergedPdfBytes));
  } catch (err) {
    console.error("Gagal membuat e-portfolio:", err);
    res.status(500).json({ message: "Server error", error: err.message });
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
  getFullTaskSubmissionsByUser,
  downloadEportfolioAsPdf,
};
