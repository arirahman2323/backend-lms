const express = require("express");
const { getSurvei, postSurvei, updateSurvei, deleteSurvei, getSurveiByIdUser } = require("../controllers/surveiController");

const { protect, adminOnly } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", protect, adminOnly, getSurvei);
router.get("/:id", protect, getSurveiByIdUser); // Assuming you want to get a specific survey by ID
router.post("/", protect, postSurvei);
router.put("/:id", protect, adminOnly, updateSurvei);
router.delete("/:id", protect, adminOnly, deleteSurvei);

module.exports = router;
