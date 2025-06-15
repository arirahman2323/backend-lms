const Task = require("../models/Task");             // ← import Task
const TaskSubmission = require("../models/TaskSubmission");

// @desc    Submit task answer
// @route   POST /api/task-submissions/:taskId
// @access  Private (Member)
const submitTaskAnswer = async (req, res) => {
  try {
    const { essayAnswers = [], multipleChoiceAnswers = [] } = req.body;
    const { taskId } = req.params;                  // ← ambil dari params
    const userId = req.user._id;

    // 1. cek task
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // 2. cek duplikat submission
    const alreadySubmitted = await TaskSubmission.findOne({ task: taskId, user: userId });
    if (alreadySubmitted) {
      return res.status(400).json({ message: "You have already submitted this task" });
    }

    // 3. simpan
    const submission = await TaskSubmission.create({
      task: taskId,
      user: userId,
      essayAnswers,
      multipleChoiceAnswers,
    });

    res.status(201).json({ message: "Task submitted successfully", submission });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { submitTaskAnswer };
