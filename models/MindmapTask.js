const mongoose = require("mongoose");

const rubricSchema = new mongoose.Schema({
  text: { type: String },
  file: { type: String }, // nama file (gambar/pdf)
}, { _id: false });

const mindmapTaskSchema = new mongoose.Schema({
  instructions: { type: String, required: true },
  rubric: [rubricSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // ✅ Tambahan field baru (tidak mengubah yang ada)
  description: { type: String },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  dueDate: { type: Date },
  status: {
    type: String,
    enum: ["Pending", "In Progress", "Completed"],
    default: "Pending"
  },
  attachments: [{
    name: String,
    url: String
  }],
  todoChecklist: [{
    text: String,
    completed: {
      type: Boolean,
      default: false
    }
  }],
  title: { type: String },
  progress: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
}, { timestamps: true });

// ✅ Hindari OverwriteModelError saat development
module.exports = mongoose.models.MindmapTask || mongoose.model("MindmapTask", mindmapTaskSchema);
