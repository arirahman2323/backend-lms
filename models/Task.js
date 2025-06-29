const mongoose = require("mongoose");

const todoSchema = new mongoose.Schema({
  text: { type: String },
  completed: { type: Boolean, default: false },
});

const mcqSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    question: { type: String },
    options: [{ type: String }],
    answer: { type: String },
  },
  { _id: false }
);

const essaySchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    question: { type: String },
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    problem: { type: String },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
  },
  { _id: false }
);
const taskSchema = new mongoose.Schema(
  {
    title: { type: String },
    description: { type: String },
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    status: { type: String, enum: ["Pending", "In Progress", "Completed"], default: "Pending" },
    dueDate: { type: Date },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    attachments: [{ type: String }],
    todoChecklist: [todoSchema],
    progress: { type: Number, default: 0 },
    essayQuestions: [essaySchema],
    multipleChoiceQuestions: [mcqSchema],
    isPretest: { type: Boolean, default: false },
    isPostest: { type: Boolean, default: false },
    isProblem: { type: Boolean, default: false },
    isRefleksi: { type: Boolean, default: false },
    isKbk: { type: Boolean, default: false },
    isLo: { type: Boolean, default: false },

    // ✅ Tambahan baru
    problem: [problemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
