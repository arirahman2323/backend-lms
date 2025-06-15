const Task = require("../models/Task");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin)
const getUsers = async (req, res) => {
    try {
        const users = await User.find({role: "member"}).select("-password");

        // Add Tasks count to each user
        const usersWithTasks = await Promise.all(
            users.map(async (user) => {
                const pendingTasks = await Task.countDocuments({ assignedTo: user._id, status: "Pending" });
                const inProgressTasks = await Task.countDocuments({ assignedTo: user._id, status: "In Progress" });
                const completedTasks = await Task.countDocuments({ assignedTo: user._id, status: "Completed" });

                return {
                    ...user._doc,
                    pendingTasks,
                    inProgressTasks,
                    completedTasks,
                };
            })
        );
        res.json(usersWithTasks);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private=
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


// ─────────────────────────────────────────────────────────────
// NEW: Update user by ID  ←――――――――――――――――――――――――――――――――――
// ─────────────────────────────────────────────────────────────
// @desc    Update user (all fields)
// @route   PUT /api/users/:id
// @access  Private (Admin)
const updateUser = async (req, res) => {
  try {
    const {
      name,
      nim,
      offering,
      email,
      username,
      password,
      profileImageUrl,
      role,
    } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Perbarui semua field jika dikirim dalam body
    if (name !== undefined) user.name = name;
    if (nim !== undefined) user.nim = nim;
    if (offering !== undefined) user.offering = offering;
    if (email !== undefined) user.email = email;
    if (username !== undefined) user.username = username;
    if (profileImageUrl !== undefined) user.profileImageUrl = profileImageUrl;
    if (role !== undefined) user.role = role;

    // Hash password jika diberikan password baru
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    const savedUser = await user.save();
    const { password: _, ...userWithoutPassword } = savedUser.toObject();

    res.json({ message: "User updated successfully", data: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete user by ID
// @route   DELETE /api/users/:id
// @access  Private (Admin)
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        await user.remove();
        res.json({ message: "User deleted" });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
};