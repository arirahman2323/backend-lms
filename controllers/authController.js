const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail"); // util untuk mengirim email

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, username, password, profileImageUrl, adminInviteToken } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
    let role = "member";
    if (adminInviteToken && adminInviteToken == process.env.ADMIN_INVITE_TOKEN) {
      role = "admin";
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      username,
      password: hashedPassword,
      profileImageUrl,
      role,
    });
    const token = generateToken(user._id);
    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Return user data with JWT
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private (Requires JWT)
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private (Requires JWT)
const updateUserProfile = async (req, res) => {
  try {
    const User = await User.findById(req.user.id);
    if (!User) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
      profileImageUrl: updatedUser.profileImageUrl,
      token: generateToken(updatedUser._id),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Logout user (JWT-based, optional blacklist support)
// @route   POST /api/auth/logout
// @access  Private (Requires JWT)
const logoutUser = async (req, res) => {
  try {
    // Jika ingin blacklist, ambil token dari header:
    const token = req.headers.authorization?.split(" ")[1];

    // Jika kamu ingin simpan token ke DB blacklist, bisa lakukan di sini.
    // Contoh: await BlacklistToken.create({ token });

    // Atau cukup log activity
    console.log(`User with ID ${req.user.id} logged out`);

    // Frontend yang akan menghapus tokennya
    return res.status(200).json({ message: "Logout berhasil" });
  } catch (error) {
    return res.status(500).json({ message: "Logout error", error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email tidak ditemukan" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.RESET_PASSWORD_ORIGIN}/${resetToken}`;
    const html = `
      <p>Halo ${user.name},</p>
      <p>Klik link berikut untuk mengatur ulang password Anda:</p>
      <a href="${resetURL}" target="_blank">${resetURL}</a>
      <p>Link ini hanya berlaku selama 15 menit.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: "Reset Password",
      html,
    });

    res.status(200).json({ message: "Link reset telah dikirim ke email Anda." });
  } catch (error) {
    res.status(500).json({ message: "Gagal kirim email", error: error.message });
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "Token tidak valid atau telah kedaluwarsa" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: "Password berhasil direset" });
  } catch (error) {
    res.status(500).json({ message: "Gagal reset password", error: error.message });
  }
};

module.exports = { registerUser, loginUser, getUserProfile, updateUserProfile, logoutUser, forgotPassword, resetPassword };
