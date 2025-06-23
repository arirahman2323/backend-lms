const express = require("express");
const {
  getSurvei,
  postSurvei,
  updateSurvei,
  deleteSurvei,
} = require("../controllers/surveiController");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", protect, getSurvei);
router.post("/", protect, postSurvei);
router.put("/:id", protect, updateSurvei);
router.delete("/:id", protect, deleteSurvei);

module.exports = router;
