const express = require('express');
const { check, param, query, validationResult } = require('express-validator');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUsersGroupedByInterests
} = require('../controllers/userController');
const { getUserPosts } = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

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

const idValidation = [
  param('id').isMongoId().withMessage('Invalid user id'),
  validate
];

// Scenario 2: Public route to retrieve all posts of a user via single $lookup aggregation pipeline
// Placed BEFORE admin auth middleware so it is accessible publicly
router.get('/:id/posts', idValidation, getUserPosts);

// All subsequent user management routes require authentication and admin role
router.use(protect, authorize('admin'));

const createValidation = [
  check('name', 'Name is required').trim().notEmpty(),
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  check('role', 'Role must be user or admin').optional().isIn(['user', 'admin']),
  check('interests', 'Interests must be an array of strings')
    .optional()
    .isArray()
    .custom((items) => items.every((i) => typeof i === 'string')),
  validate
];

const updateValidation = [
  param('id').isMongoId().withMessage('Invalid user id'),
  check('name', 'Name cannot be empty').optional().trim().notEmpty(),
  check('email', 'Please include a valid email').optional().isEmail().normalizeEmail(),
  check('password', 'Password must be at least 6 characters').optional().isLength({ min: 6 }),
  check('role', 'Role must be user or admin').optional().isIn(['user', 'admin']),
  check('interests', 'Interests must be an array of strings')
    .optional()
    .isArray()
    .custom((items) => items.every((i) => typeof i === 'string')),
  validate
];

const groupedValidation = [
  query('interest', 'Interest cannot be empty').optional().trim().notEmpty(),
  validate
];

// Scenario 1: Aggregation route registered BEFORE /:id to prevent route collision
router.get('/grouped-by-interests', groupedValidation, getUsersGroupedByInterests);

router.get('/', getUsers);
router.post('/', createValidation, createUser);
router.get('/:id', idValidation, getUserById);
router.put('/:id', updateValidation, updateUser);
router.delete('/:id', idValidation, deleteUser);

module.exports = router;
