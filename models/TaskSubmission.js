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

const taskSubmissionSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    essayAnswers: [essayAnswerSchema],
    multipleChoiceAnswers: [mcqAnswerSchema],
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TaskSubmission", taskSubmissionSchema);
