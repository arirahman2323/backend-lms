const express = require("express");
const { createGroup, getUserGroups, getGroupMessages, sendGroupMessage } = require("../controllers/groupController.js");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
const Group = require("../models/Group");

// GET /api/groups/problem/:problemId
module.exports = function (io) {
  const router = express.Router();

  // Tambahkan endpoint untuk get group by problemId
  router.get("/problem/:problemId", async (req, res) => {
    try {
      const group = await Group.findOne({ problemId: req.params.problemId }).populate("members", "name email");
      if (!group) {
        return res.status(404).json({ message: "Group not found for this problem" });
      }
      res.json(group);
    } catch (error) {
      console.error("Error fetching group by problem:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });

  // Gunakan closure untuk mengoper `io` ke controller yang membutuhkannya
  router.post("/create", protect, (req, res) => createGroup(req, res));
  router.get("/", protect, (req, res) => getUserGroups(req, res));
  router.get("/:groupId/messages", protect, (req, res) => getGroupMessages(req, res));
  router.post("/:groupId/send", protect, sendGroupMessage(io));

  return router;
};
