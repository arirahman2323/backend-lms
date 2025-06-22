const Task = require("../models/Task");
const TaskSubmission = require("../models/TaskSubmission");

// @desc    Submit task answer (for pretest or posttest)
// @route   POST /api/task-submissions/:type/:taskId
// @access  Private (Member)
const submitTaskAnswer = async (req, res) => {
  try {
    const { type, taskId } = req.params;
    const { essayAnswers = [], multipleChoiceAnswers = [] } = req.body;
    const userId = req.user._id;

    if (type !== "pretest" && type !== "posttest") {
      return res.status(400).json({ message: "Type must be 'pretest' or 'posttest'" });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (type === "pretest" && !task.isPretest) {
      return res.status(400).json({ message: "This task is not marked as a pretest" });
    }
    if (type === "posttest" && !task.isPosttest) {
      return res.status(400).json({ message: "This task is not marked as a posttest" });
    }

    const alreadySubmitted = await TaskSubmission.findOne({ task: taskId, user: userId });
    if (alreadySubmitted) {
      return res.status(400).json({ message: "You have already submitted this task" });
    }

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

// @desc    Get all task submissions by user ID and task type
// @route   GET /api/task-submissions/:type/user/:userId
// @access  Private (Admin or user himself)
const getSubmissionsByUser = async (req, res) => {
  try {
    const { userId, type } = req.params;

    if (type !== "pretest" && type !== "posttest") {
      return res.status(400).json({ message: "Type must be 'pretest' or 'posttest'" });
    }

    const submissions = await TaskSubmission.find({ user: userId }).populate("task", "title isPretest isPosttest dueDate").lean();

    const filtered = submissions.filter((sub) => (type === "pretest" ? sub.task?.isPretest : sub.task?.isPosttest));

    res.json({
      userId,
      type,
      totalTasks: filtered.length,
      submissions: filtered,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all task submissions (Admin only)
// @route   GET /api/task-submissions
// @access  Private (Admin)
const getAllSubmissions = async (req, res) => {
  try {
    const submissions = await TaskSubmission.find().populate("task", "title isPretest isPosttest dueDate").populate("user", "name email role").lean();

    res.json({
      totalSubmissions: submissions.length,
      submissions,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get submissions by task ID (Admin only)
// @route   GET /api/task-submissions/task/:taskId
// @access  Private (Admin)
const getSubmissionsByTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const submissions = await TaskSubmission.find({ task: taskId }).populate("task", "title isPretest isPosttest dueDate").populate("user", "name email role").lean();

    res.json({
      taskId,
      totalSubmissions: submissions.length,
      submissions,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update essay scores by submission ID
// @route   POST /api/task-submissions/score-essay/:submissionId
// @access  Private (Admin)

// @desc    Update essay scores by user and type
// @route   POST /api/task-submissions/score-essay/:type/:userId
// @access  Private (Admin)
const updateEssayScoresByUserType = async (req, res) => {
  try {
    const { type, userId } = req.params;
    const { scores = [] } = req.body;

    // Validasi tipe
    if (type !== "pretest" && type !== "postest") {
      return res.status(400).json({ message: "Type must be 'pretest' or 'postest'" });
    }

    // Ambil semua submission milik user
    const submissions = await TaskSubmission.find({ user: userId }).populate("task");

    // Filter submission berdasarkan jenis tugas
    const targetSubmissions = submissions.filter((sub) => (type === "pretest" ? sub.task?.isPretest : sub.task?.isPosttest));

    let totalUpdated = 0;

    for (const submission of targetSubmissions) {
      let updated = false;

      submission.essayAnswers = submission.essayAnswers.map((answer) => {
        const answerQid = answer.questionId?.toString();
        const found = scores.find((s) => s.questionId?.toString() === answerQid);

        if (found) {
          updated = true;
          totalUpdated++;
          return {
            questionId: answer.questionId,
            answer: answer.answer,
            score: found.score,
          };
        }

        return answer;
      });

      if (updated) {
        submission.markModified("essayAnswers");

        // Tambahkan logika menghitung total skor essay
        submission.score = submission.essayAnswers.reduce((total, ans) => total + (ans.score || 0), 0);

        await submission.save();
        console.log(`✅ Skor diperbarui: Submission ${submission._id}, total score: ${submission.score}`);
      }
    }

    res.json({
      message: `✅ Updated ${totalUpdated} essay score(s) for user ${userId} and type '${type}'`,
    });
  } catch (error) {
    console.error("❌ Error updating essay scores:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update total score of a submission
// @route   POST /api/task-submissions/:type/:taskId/score/:userId
// @access  Private (Admin)
const updateTotalScore = async (req, res) => {
  try {
    const { type, taskId, userId } = req.params;
    const { score } = req.body;

    // Validasi tipe
    if (type !== "pretest" && type !== "postest") {
      return res.status(400).json({ message: "Type must be 'pretest' or 'postest'" });
    }

    if (typeof score !== "number") {
      return res.status(400).json({ message: "Score must be a number" });
    }

    // Ambil semua submission milik user
    const submissions = await TaskSubmission.find({ user: userId }).populate("task");

    // Filter submission berdasarkan jenis tugas
    const targetSubmissions = submissions.filter((sub) => (type === "pretest" ? sub.task?.isPretest : sub.task?.isPosttest));

    const submissionToUpdate = targetSubmissions.find((sub) => sub.task._id.toString() === taskId);

    if (!submissionToUpdate) {
      return res.status(404).json({ message: "Submission not found for given user, task, and type" });
    }

    submissionToUpdate.score = score;
    submissionToUpdate.task.status = "Completed";
    await submissionToUpdate.save();

    res.json({
      message: "✅ Score updated successfully",
      updatedSubmission: submissionToUpdate,
    });
  } catch (error) {
    console.error("❌ Error updating total score:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  submitTaskAnswer,
  getSubmissionsByUser,
  getAllSubmissions,
  updateEssayScoresByUserType,
  getSubmissionsByTask,
  updateTotalScore,
};
