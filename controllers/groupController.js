const Group = require("../models/Group.js");
const GroupMessage = require("../models/GroupMessage.js");

const createGroup = async (req, res) => {
  try {
    const { name, members, groupImage } = req.body;

    if (!name || !members || members.length < 2) {
      return res.status(400).json({ message: "Grup harus memiliki nama dan minimal 2 anggota" });
    }

    const uniqueMembers = Array.from(new Set([...members, req.user._id.toString()]));

    const group = await Group.create({
      name,
      members: uniqueMembers,
      groupImage: groupImage || "",
    });

    res.status(201).json(group);
  } catch (error) {
    console.error("Error creating group:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getUserGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id });
    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;

    const messages = await GroupMessage.find({ groupId }).sort({ createdAt: 1 }).populate("senderId", "_id name profileImageUrl").lean();

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching group messages:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Fungsi ini menerima io sebagai argumen tambahan
const sendGroupMessage = (io) => async (req, res) => {
  console.log("🔥 Route /api/groups/:groupId/send HIT");
  try {
    const { message, image } = req.body;
    const { groupId } = req.params;
    const senderId = req.user._id;

    const newMessage = new GroupMessage({
      groupId,
      senderId,
      message,
      image: image || null,
    });

    await newMessage.save();

    const populatedMessage = await GroupMessage.findById(newMessage._id).populate("senderId", "_id fullName profilePict").lean();

    // Emit ke room socket.io berdasarkan groupId
    io.to(groupId).emit("group:message", populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error sending group message:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  createGroup,
  getUserGroups,
  getGroupMessages,
  sendGroupMessage,
};
