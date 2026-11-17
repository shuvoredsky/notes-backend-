const mongoose = require('mongoose');
const Note = require('../models/Note');
const { getPagination, buildMeta } = require('../utils/pagination');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');

const createNote = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const note = await Note.create({
      title,
      content,
      owner: req.user._id
    });

    return sendSuccess(res, note, 'Note created successfully', 201);
  } catch (error) {
    next(error);
  }
};

const getNotes = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.user.role === 'admin') {
      if (req.query.owner) {
        if (!mongoose.isValidObjectId(req.query.owner)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid owner id'
          });
        }
        filter.owner = req.query.owner;
      }
    } else {
      filter.owner = req.user._id;
    }

    let query = Note.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

    if (req.user.role === 'admin') {
      query = query.populate('owner', 'name email');
    }

    const [notes, total] = await Promise.all([
      query,
      Note.countDocuments(filter)
    ]);

    const meta = buildMeta(total, page, limit);

    return sendPaginated(res, notes, meta, 'Notes retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getNoteById = async (req, res, next) => {
  try {
    let query = Note.findById(req.params.id);

    if (req.user.role === 'admin') {
      query = query.populate('owner', 'name email');
    }

    const note = await query;

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    const noteOwnerId = note.owner._id ? note.owner._id.toString() : note.owner.toString();

    if (req.user.role === 'user' && noteOwnerId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: not your note'
      });
    }

    return sendSuccess(res, note, 'Note retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const updateNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    if (req.user.role === 'user' && note.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: not your note'
      });
    }

    if (req.body.title !== undefined) {
      note.title = req.body.title;
    }

    if (req.body.content !== undefined) {
      note.content = req.body.content;
    }

    await note.save();

    return sendSuccess(res, note, 'Note updated successfully');
  } catch (error) {
    next(error);
  }
};

const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    if (req.user.role === 'user' && note.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: not your note'
      });
    }

    await note.deleteOne();

    return sendSuccess(res, null, 'Note deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote
};

