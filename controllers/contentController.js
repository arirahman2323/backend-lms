const Content = require("../models/Content");

const createContent = async (req, res) => {
  try {
    const { 
      type,
      title,
      term,
      content,
      description,
      priority,
      dueDate,
      assignedTo = [],
      attachments,
      todoChecklist
    } = req.body;

    if (!type || !["materi", "glosarium"].includes(type)) {
      return res.status(400).json({ message: "Type must be 'materi' or 'glosarium'" });
    }

    if (type === "materi" && !title) {
      return res.status(400).json({ message: "Title is required for materi" });
    }

    if (type === "glosarium" && !term) {
      return res.status(400).json({ message: "Term is required for glosarium" });
    }

    if (!content) {
      return res.status(400).json({ message: "Content is required" });
    }

    // Parse file list
    const files = req.files?.map(f => `${req.protocol}://${req.get("host")}/uploads/${f.filename}`) || [];

    // Parse JSON fields
    let parsedAttachments = [];
    let parsedChecklist = [];

    try {
      if (attachments) parsedAttachments = JSON.parse(attachments);
      if (todoChecklist) parsedChecklist = JSON.parse(todoChecklist);
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON in attachments or todoChecklist" });
    }

    const newContent = await Content.create({
      type,
      title: type === "materi" ? title : undefined,
      term: type === "glosarium" ? term : undefined,
      content,
      description,
      priority,
      dueDate,
      assignedTo,
      attachments: parsedAttachments,
      todoChecklist: parsedChecklist,
      files,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: `${type === "materi" ? "Material" : "Glossary"} created`,
      content: newContent,
    });

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


const getContents = async (req, res) => {
  try {
    const contents = await Content.find().sort({ createdAt: -1 });
    res.json(contents);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const getContentsByType = async (req, res) => {
  try {
    const { type } = req.params;

    if (!["materi", "glosarium"].includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    const contents = await Content.find({ type }).sort({ createdAt: -1 });
    res.json(contents);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const updateContent = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    const {
      type,
      title,
      term,
      content: newContentText,
      description,
      priority,
      dueDate,
      assignedTo,
      attachments,
      todoChecklist,
    } = req.body;

    const newFiles = req.files?.map(f => `${req.protocol}://${req.get("host")}/uploads/${f.filename}`) || [];

    if (type && !["materi", "glosarium"].includes(type)) {
      return res.status(400).json({ message: "Type must be 'materi' or 'glosarium'" });
    }

    if (type) content.type = type;
    if (type === "materi" && title !== undefined) content.title = title;
    if (type === "glosarium" && term !== undefined) content.term = term;

    if (newContentText !== undefined) content.content = newContentText;
    if (description !== undefined) content.description = description;
    if (priority !== undefined) content.priority = priority;
    if (dueDate !== undefined) content.dueDate = dueDate;
    if (assignedTo !== undefined) {
      content.assignedTo = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    }

    try {
      if (attachments !== undefined) {
        content.attachments = typeof attachments === "string" ? JSON.parse(attachments) : attachments;
      }
      if (todoChecklist !== undefined) {
        content.todoChecklist = typeof todoChecklist === "string" ? JSON.parse(todoChecklist) : todoChecklist;
      }
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON in attachments or todoChecklist" });
    }

    if (newFiles.length > 0) {
      content.files = [...content.files, ...newFiles];
    }

    await content.save();
    res.json({ message: "Content updated", content });

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const updateContentStatus = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) return res.status(404).json({ message: "content not found" });

    content.status = req.body.status || content.status;

    if (content.status === "Completed") {
      content.todoChecklist.forEach((item) => (item.completed = true));
      content.progress = 100;
    }

    await content.save();

    res.json({ message: "content status updated", content });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const fs = require("fs");
const path = require("path");

const deleteContent = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    // Hapus semua file di content.files (jika ada)
    if (Array.isArray(content.files)) {
      content.files.forEach((fileUrl) => {
        // Ekstrak nama file dari URL
        const filename = fileUrl.split("/uploads/")[1];
        const filepath = path.join(__dirname, "..", "uploads", filename);

        fs.unlink(filepath, (err) => {
          if (err) {
            console.warn(`⚠️ Failed to delete file ${filename}:`, err.message);
          }
        });
      });
    }

    await content.deleteOne();
    res.json({ message: "Content and files deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


const deleteContentFilesOnly = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) return res.status(404).json({ message: "Content not found" });

    const { filename } = req.params;
    const fileIndex = content.files.findIndex((url) => url.includes(filename));

    if (fileIndex === -1) {
      return res.status(404).json({ message: "File not found in content" });
    }

    // Hapus file dari sistem file
    const filepath = path.join(__dirname, "..", "uploads", filename);
    fs.unlink(filepath, (err) => {
      if (err) console.warn(`⚠️ File deletion failed: ${err.message}`);
    });

    // Hapus dari array di MongoDB
    content.files.splice(fileIndex, 1);
    await content.save();

    res.json({ message: `File ${filename} deleted`, content });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


module.exports = {
  createContent,
  getContents,
  getContentsByType,
  deleteContent,
  updateContent,
  updateContentStatus,
  deleteContentFilesOnly
};
