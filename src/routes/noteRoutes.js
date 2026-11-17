const express = require('express');
const { check, param, validationResult } = require('express-validator');
const {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote
} = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

const createValidation = [
  check('title', 'Title is required').trim().notEmpty(),
  check('content', 'Content is required').trim().notEmpty(),
  validate
];

const updateValidation = [
  param('id').isMongoId().withMessage('Invalid note id'),
  check('title', 'Title cannot be empty').optional().trim().notEmpty(),
  check('content', 'Content cannot be empty').optional().trim().notEmpty(),
  validate
];

const idValidation = [
  param('id').isMongoId().withMessage('Invalid note id'),
  validate
];

router.post('/', createValidation, createNote);
router.get('/', getNotes);
router.get('/:id', idValidation, getNoteById);
router.put('/:id', updateValidation, updateNote);
router.delete('/:id', idValidation, deleteNote);

module.exports = router;

