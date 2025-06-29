const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["materi", "glosarium"],
    required: true,
  },
  title: {
    type: String,
    required: function () {
      return this.type === "materi";
    },
  },
  term: {
    type: String,
    required: function () {
      return this.type === "glosarium";
    },
  },
  content: {
    type: String,
    required: true,
  },
  
  status: { type: String, enum: ["Pending", "In Progress", "Completed"], default: "Pending" },

  description: {
    type: String,
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },
  dueDate: {
    type: Date,
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  attachments: [{
    name: String,
    url: String,
  }],
  todoChecklist: [{
    text: String,
    completed: {
      type: Boolean,
      default: false,
    },
  }],
  files: {
    type: [String],
    default: [],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model("Content", contentSchema);
