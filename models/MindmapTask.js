const mongoose = require("mongoose");

const rubricSchema = new mongoose.Schema({
  text: { type: String },
  file: { type: String }, // nama file (gambar/pdf)
}, { _id: false });

const mindmapTaskSchema = new mongoose.Schema({
  instructions: { type: String, required: true },
  rubric: [rubricSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

module.exports = mongoose.model("MindmapTask", mindmapTaskSchema);