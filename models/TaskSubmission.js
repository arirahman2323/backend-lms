const mongoose = require("mongoose");

const essayAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    answer: { type: String, required: true },
  },
  { _id: false }
);

const mcqAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    selectedOption: { type: String, required: true },
  },
  { _id: false }
);
const problemAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    problem: { type: String, required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  },
  { _id: false }
);

const taskSubmission = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    essayAnswers: [essayAnswerSchema],
    multipleChoiceAnswers: [mcqAnswerSchema],
    score: { type: Number, default: 0 },
    explanation: { type: String },
    feedbackFile: { type: String }, // File path for feedback PDF
    submittedAt: { type: Date, default: Date.now },

    // ✅ Tambahan
    problemAnswer: [problemAnswerSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("TaskSubmission", taskSubmission);
