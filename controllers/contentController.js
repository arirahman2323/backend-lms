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

    const files = req.files?.map(f => f.path || f.filename) || [];

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

    // Parse attachments and todoChecklist if sent as JSON string
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

    const files = req.files?.map(f => f.path || f.filename) || [];

    // Validasi type (opsional jika tidak ingin mengganti type)
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

    // Handle JSON-parsed fields
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

    // Tambah file baru jika ada
    if (files.length > 0) {
      content.files = [...content.files, ...files];
    }

    await content.save();
    res.json({ message: "Content updated", content });

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

const deleteContent = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    await content.deleteOne(); // ✅ ganti .remove()

    res.json({ message: "Content deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


module.exports = {
  createContent,
  getContents,
  getContentsByType,
  deleteContent,
  updateContent
};
