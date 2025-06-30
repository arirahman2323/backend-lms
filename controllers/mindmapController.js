const MindmapTask = require("../models/MindmapTask");
const MindmapSubmission = require("../models/MindmapSubmission");
const { updateTaskStatus } = require("./taskController");

/* ──────────────── ADMIN ──────────────── */

// ✅ Create mindmap task
const createMindmapTask = async (req, res) => {
  try {
    const {
      instructions,
      description,
      dueDate,
      status,
      attachments,
      todoChecklist,
      title
    } = req.body;

    if (!instructions) {
      return res.status(400).json({ message: "Instructions are required" });
    }

    const rubricTexts = Array.isArray(req.body.rubric)
      ? req.body.rubric
      : req.body.rubric
        ? [req.body.rubric]
        : [];

    const rubricFiles = req.files || [];

    // Buat data rubric lengkap dengan file URL
    const rubric = rubricTexts.map((text, idx) => ({
      text,
      file: rubricFiles[idx]
        ? `${req.protocol}://${req.get("host")}/uploads/${rubricFiles[idx].filename}`
        : null,
    }));

    // Parse attachments dan todoChecklist (jika dikirim sebagai JSON string)
    let parsedAttachments = [];
    let parsedChecklist = [];

    try {
      if (attachments) parsedAttachments = JSON.parse(attachments);
      if (todoChecklist) parsedChecklist = JSON.parse(todoChecklist);
    } catch (err) {
      return res.status(400).json({
        message: "Invalid JSON in attachments or todoChecklist"
      });
    }

    // Simpan ke database
    const task = await MindmapTask.create({
      instructions,
      rubric,
      description,
      dueDate,
      status,
      attachments: parsedAttachments,
      todoChecklist: parsedChecklist,
      createdBy: req.user._id,
      title,
    });

    res.status(201).json({ message: "Mindmap task created", task });

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// ✅ Update mindmap task
const updateMindmapTask = async (req, res) => {
  try {
    const task = await MindmapTask.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const {
      instructions,
      description,
      dueDate,
      status,
      attachments,
      todoChecklist
    } = req.body;

    if (instructions !== undefined) task.instructions = instructions;
    if (description !== undefined) task.description = description;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (status !== undefined) task.status = status;

    // Rubric update
    const rubricTexts = Array.isArray(req.body.rubric)
      ? req.body.rubric
      : req.body.rubric
        ? [req.body.rubric]
        : [];

    const rubricFiles = req.files || [];

    if (rubricTexts.length > 0) {
      task.rubric = rubricTexts.map((text, idx) => {
        const existingFile = task.rubric?.[idx]?.file || null;
        return {
          text,
          file: rubricFiles[idx]
            ? `${req.protocol}://${req.get("host")}/uploads/${rubricFiles[idx].filename}`
            : existingFile, // gunakan file lama jika tidak diunggah ulang
        };
      });
    }

    // Parse JSON fields if sent as string
    try {
      if (attachments !== undefined) {
        task.attachments = typeof attachments === "string" ? JSON.parse(attachments) : attachments;
      }
      if (todoChecklist !== undefined) {
        task.todoChecklist = typeof todoChecklist === "string" ? JSON.parse(todoChecklist) : todoChecklist;
      }
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON in attachments or todoChecklist" });
    }

    await task.save();
    res.json({ message: "Task updated", task });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const updateMindmapStatus = async (req, res) => {
  try {
    const mindmap = await  MindmapTask.findById(req.params.id);
    if (!mindmap) return res.status(404).json({ message: "mindmap not found" });

    mindmap.status = req.body.status || mindmap.status;

    if (mindmap.status === "Completed") {
      mindmap.todoChecklist.forEach((item) => (item.completed = true));
      mindmap.progress = 100;
    }

    await mindmap.save();
    res.json({ message: "mindmap status updated", mindmap });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// ✅ Delete task and its submissions
const fs = require("fs");
const path = require("path");

const deleteMindmapTask = async (req, res) => {
  try {
    const task = await MindmapTask.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Mindmap Task not found" });

    // 🔥 Hapus file rubric jika ada
    if (Array.isArray(task.rubric)) {
      task.rubric.forEach((r) => {
        if (r.file) {
          const filePath = path.join(__dirname, "../uploads", path.basename(r.file));
          fs.unlink(filePath, (err) => {
            if (err && err.code !== "ENOENT") {
              console.error("Failed to delete rubric file:", filePath, err.message);
            }
          });
        }
      });
    }

    // 🔥 Hapus semua submission
    const submissions = await MindmapSubmission.find({ task: task._id });

    for (const sub of submissions) {
      if (sub.answerPdf) {
        const subFilePath = path.join(__dirname, "../uploads", path.basename(sub.answerPdf));
        fs.unlink(subFilePath, (err) => {
          if (err && err.code !== "ENOENT") {
            console.error("Failed to delete submission file:", subFilePath, err.message);
          }
        });
      }
    }

    await MindmapSubmission.deleteMany({ task: task._id });
    await task.deleteOne();

    res.json({ message: "Mindmap task and files deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// ✅ Score a submission
const giveMindmapScore = async (req, res) => {
  try {
    const { id } = req.params;
    const { score } = req.body;

    const submission = await MindmapSubmission.findById(id);
    if (!submission) return res.status(404).json({ message: "Submission not found" });

    submission.score = score;
    await submission.save();

    res.json({ message: "Score updated", submission });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ Get all submissions for a task
const getSubmissionsByTask = async (req, res) => {
  try {
    const submissions = await MindmapSubmission.find({ task: req.params.taskId }).populate("user", "name email");
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ Get all submissions (admin)
const getAllSubmissions = async (req, res) => {
  try {
    const submissions = await MindmapSubmission.find()
      .populate("user", "name email")
      .populate("task", "instructions");
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
/* ──────────────── USER ──────────────── */

// ✅ Submit mindmap answer (PDF)
const submitMindmapAnswer = async (req, res) => {
  try {
    const { taskId } = req.params;
    const file = req.file;

    if (!file || file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Please upload a valid PDF file" });
    }

    // Cek jika user sudah pernah submit
    const existing = await MindmapSubmission.findOne({
      task: taskId,
      user: req.user._id,
    });
    if (existing) {
      return res.status(400).json({ message: "You already submitted" });
    }

    // Simpan dengan URL lengkap
    const submission = await MindmapSubmission.create({
      task: taskId,
      user: req.user._id,
      answerPdf: `${req.protocol}://${req.get("host")}/uploads/${file.filename}`,
    });

    res.status(201).json({ message: "Answer submitted", submission });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// ✅ Get my submission (user)
const getMySubmission = async (req, res) => {
  try {
    const submission = await MindmapSubmission.findOne({ task: req.params.taskId, user: req.user._id });
    if (!submission) return res.status(404).json({ message: "Submission not found" });
    res.json(submission);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* ──────────────── COMMON ──────────────── */

// ✅ Get all tasks
const getAllMindmapTasks = async (req, res) => {
  try {
    const tasks = await MindmapTask.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ Get task by ID
const getMindmapTaskById = async (req, res) => {
  try {
    const task = await MindmapTask.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getSubmissionsByUser = async (req, res) => {
  try {
    const submissions = await MindmapSubmission.find({ user: req.params.userId }).populate("task");
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


/* ──────────────── EXPORT ──────────────── */

module.exports = {
  createMindmapTask,
  updateMindmapTask,
  deleteMindmapTask,
  giveMindmapScore,
  getSubmissionsByTask,
  submitMindmapAnswer,
  getMySubmission,
  getAllMindmapTasks,
  getMindmapTaskById,
  getAllSubmissions,
  updateMindmapStatus,
  getSubmissionsByUser
};
