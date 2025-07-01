const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middlewares/authMiddleware");

const { submitTaskAnswer, 
    getSubmissionsByUser, 
    getAllSubmissions, 
    updateEssayScoresByUserType, 
    getSubmissionsByTask, 
    updateTotalScore } = require("../controllers/taskSubmissionController");

// Task Submission Routes
router.post("/:type/:taskId", protect, submitTaskAnswer);
// get submissions by user
router.get("/:type/user/:userId", protect, getSubmissionsByUser);
// get all task submissions
router.get("/", protect, adminOnly, getAllSubmissions);
// update essay scores
router.post("/score-essay/:type/:userId", protect, adminOnly, updateEssayScoresByUserType);
// get submissions by task
router.get("/task/:taskId", protect, adminOnly, getSubmissionsByTask);
// Update total score of a submission
router.post("/:type/:taskId/score/:userId", protect, adminOnly, updateTotalScore);

module.exports = router;
