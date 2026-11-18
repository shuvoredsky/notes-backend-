const User = require('../models/User');
const Note = require('../models/Note');
const Post = require('../models/Post');
const { getPagination, buildMeta } = require('../utils/pagination');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');

const getUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments()
    ]);

    const meta = buildMeta(total, page, limit);

    return sendPaginated(res, users, meta, 'Users retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return sendSuccess(res, user, 'User retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, interests } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user',
      interests
    });

    return sendSuccess(res, user, 'User created successfully', 201);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { name, email, role, interests, password } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }
      user.email = email;
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (interests !== undefined) user.interests = interests;
    if (password !== undefined) user.password = password;

    await user.save();

    return sendSuccess(res, user, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.deleteOne();

    // Cascade delete: remove user notes (uses { owner: 1, createdAt: -1 } index)
    await Note.deleteMany({ owner: req.params.id });

    // Cascade delete: remove user posts (uses { author: 1, createdAt: -1 } index)
    await Post.deleteMany({ author: req.params.id });

    return sendSuccess(res, null, 'User and associated data deleted successfully');
  } catch (error) {
    next(error);
  }
};

// Scenario 1: Group users by interest using exactly ONE User.aggregate() call
const getUsersGroupedByInterests = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const interest = req.query.interest ? req.query.interest.trim().toLowerCase() : null;

    // The first $match uses the { interests: 1 } index when an interest filter is provided.
    // Without the interest filter, the aggregation reads all users (full scan is inherent to grouping all users).
    const pipeline = [];

    if (interest) {
      pipeline.push({ $match: { interests: interest } });
    }

    pipeline.push({ $unwind: '$interests' });

    if (interest) {
      pipeline.push({ $match: { interests: interest } });
    }

    pipeline.push({
      $group: {
        _id: '$interests',
        count: { $sum: 1 },
        users: {
          $push: {
            _id: '$_id',
            name: '$name',
            email: '$email'
          }
        }
      }
    });

    pipeline.push({
      $sort: { count: -1, _id: 1 }
    });

    pipeline.push({
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              interest: '$_id',
              count: 1,
              users: 1
            }
          }
        ],
        total: [{ $count: 'count' }]
      }
    });

    const [result] = await User.aggregate(pipeline);
    const data = result && result.data ? result.data : [];
    const total = result && result.total && result.total[0] ? result.total[0].count : 0;

    return sendPaginated(
      res,
      data,
      buildMeta(total, page, limit),
      'Users grouped by interest retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUsersGroupedByInterests
};
