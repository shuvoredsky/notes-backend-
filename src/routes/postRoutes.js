const express = require('express');
const { check, param, validationResult } = require('express-validator');
const {
  createPost,
  getPostById,
  updatePost,
  deletePost
} = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

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
  param('id').isMongoId().withMessage('Invalid post id'),
  check('title', 'Title cannot be empty').optional().trim().notEmpty(),
  check('content', 'Content cannot be empty').optional().trim().notEmpty(),
  validate
];

const idValidation = [
  param('id').isMongoId().withMessage('Invalid post id'),
  validate
];

router.post('/', protect, createValidation, createPost);
router.get('/:id', idValidation, getPostById);
router.put('/:id', protect, updateValidation, updatePost);
router.delete('/:id', protect, idValidation, deletePost);

module.exports = router;
