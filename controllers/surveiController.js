const Survei = require("../models/Survei");

// GET all survei
const getSurvei = async (req, res) => {
  try {
    const survei = await Survei.find().populate("idUser", "name email");
    res.status(200).json(survei);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch survei", error: error.message });
  }
};

// GET survei by user ID
const getSurveiByIdUser = async (req, res) => {
  try {
    const survei = await Survei.find({ idUser: req.params.id }).populate("idUser", "name email");

    if (!survei || survei.length === 0) {
      return res.status(404).json({ message: "No survei found for this user" });
    }

    res.status(200).json(survei);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch survei", error: error.message });
  }
};
// POST new survei
const postSurvei = async (req, res) => {
  try {
    const { idUser, typeSurvei, nilai, idTask } = req.body;

    if (!idUser || !typeSurvei || typeof nilai !== "number" || !idTask) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const survei = await Survei.create({ idUser, typeSurvei, nilai, idTask });
    res.status(201).json(survei);
  } catch (error) {
    res.status(500).json({ message: "Failed to create survei", error: error.message });
  }
};

// PUT update survei
const updateSurvei = async (req, res) => {
  try {
    const survei = await Survei.findByIdAndUpdate(req.params.id, req.body, { new: true });

    if (!survei) {
      return res.status(404).json({ message: "Survei not found" });
    }

    res.status(200).json(survei);
  } catch (error) {
    res.status(500).json({ message: "Failed to update survei", error: error.message });
  }
};

// DELETE survei
const deleteSurvei = async (req, res) => {
  try {
    const survei = await Survei.findByIdAndDelete(req.params.id);

    if (!survei) {
      return res.status(404).json({ message: "Survei not found" });
    }

    res.status(200).json({ message: "Survei deleted", survei });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete survei", error: error.message });
  }
};

module.exports = {
  getSurvei,
  postSurvei,
  updateSurvei,
  deleteSurvei,
  getSurveiByIdUser
};
