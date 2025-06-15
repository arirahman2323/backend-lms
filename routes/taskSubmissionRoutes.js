const express = require("express");
const router = express.Router();
const { submitTaskAnswer } = require("../controllers/taskSubmissionController");
const { protect } = require("../middlewares/authMiddleware");

router.post("/:taskId", protect, submitTaskAnswer);

module.exports = router;
