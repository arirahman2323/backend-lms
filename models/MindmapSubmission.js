const mongoose = require("mongoose");

const mindmapSubmissionSchema = new mongoose.Schema({
  task: { type: mongoose.Schema.Types.ObjectId, ref: "MindmapTask", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  answerPdf: { type: String, required: true }, // nama file PDF
  score: { type: Number, default: 0 }, // dinilai oleh admin
}, { timestamps: true });

module.exports = mongoose.model("MindmapSubmission", mindmapSubmissionSchema);
