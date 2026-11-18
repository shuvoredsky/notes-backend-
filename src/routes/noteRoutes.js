const express = require('express');
const { check, param, query, validationResult } = require('express-validator');
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

const paginationValidation = [
  query('page', 'Page must be a positive integer').optional().isInt({ min: 1 }),
  query('limit', 'Limit must be a positive integer').optional().isInt({ min: 1 }),
  validate
];

router.post('/', createValidation, createNote);
router.get('/', paginationValidation, getNotes);
router.get('/:id', idValidation, getNoteById);
router.put('/:id', updateValidation, updateNote);
router.delete('/:id', idValidation, deleteNote);

module.exports = router;
