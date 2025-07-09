require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const mime = require("mime-types");

const connectDB = require("./config/db");

// Import route modules
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const reportRoutes = require("./routes/reportRoutes");
const taskSubmissionRoutes = require("./routes/taskSubmissionRoutes");
const sureveiRoutes = require("./routes/surveiRoutes");
const mindmapRoutes = require("./routes/mindmapRoutes");
const contentRoutes = require("./routes/contentRoutes");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);

  socket.on("join-group", (groupId) => {
    socket.join(groupId);
    console.log(`✅ Socket ${socket.id} joined group ${groupId}`);
  });

  socket.on("leave-group", (groupId) => {
    socket.leave(groupId);
    console.log(`👋 Socket ${socket.id} left group ${groupId}`);
  });

  socket.on("sendMessage", (data) => {
    console.log("📨 Message:", data);
    io.emit("receiveMessage", data);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

const groupRoutes = require("./routes/groupRoutes")(io);

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(
  "/uploads",
  express.static("uploads", {
    setHeaders: (res, path) => {
      const contentType = mime.lookup(path) || "application/octet-stream"; // fallback
      res.set("Content-Type", contentType);

      // Untuk PDF dan gambar, tampilkan langsung di browser
      if (contentType === "application/pdf" || contentType.startsWith("image/")) {
        res.set("Content-Disposition", "inline");
      } else {
        res.set("Content-Disposition", "attachment");
      }
    },
  })
);

app.use("/public", express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/task-submissions", taskSubmissionRoutes);
app.use("/api/survei", sureveiRoutes);
app.use("/api/mindmap", mindmapRoutes); // <- mindmap endpoints
app.use("/api/materials", contentRoutes);
app.use("/api/groups", groupRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.send("📚 LMS Backend API is running.");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(500).json({ message: "Something went wrong", error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
