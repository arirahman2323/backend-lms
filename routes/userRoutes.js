const express = require("express");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const {
  getUsers,
  getUserById,
  updateUser, 
  deleteUser,
} = require("../controllers/userController");

const router = express.Router();

// Routes
router.get("/", protect, adminOnly, getUsers);
router.get("/:id", protect, getUserById);
router.put("/:id", protect, updateUser);
router.delete("/:id", protect, adminOnly, deleteUser);

module.exports = router;
