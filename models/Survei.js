const mongoose = require("mongoose");

const surveiSchema = new mongoose.Schema({
  idUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  typeSurvei: { type: String, required: true },
  nilai: { type: Number, required: true },
}, {
  timestamps: true,
});

module.exports = mongoose.model("Survei", surveiSchema);
