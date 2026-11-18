const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const { getPagination, buildMeta } = require('../utils/pagination');
const { sendSuccess, sendPaginated } = require('../utils/apiResponse');

const createPost = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const post = await Post.create({
      title,
      content,
      author: req.user._id
    });

    return sendSuccess(res, post, 'Post created successfully', 201);
  } catch (error) {
    next(error);
  }
};

const getPostById = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('author', 'name email');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    return sendSuccess(res, post, 'Post retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const isAuthor = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: not your post'
      });
    }

    if (req.body.title !== undefined) {
      post.title = req.body.title;
    }

    if (req.body.content !== undefined) {
      post.content = req.body.content;
    }

    await post.save();

    return sendSuccess(res, post, 'Post updated successfully');
  } catch (error) {
    next(error);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const isAuthor = post.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: not your post'
      });
    }

    await post.deleteOne();

    return sendSuccess(res, null, 'Post deleted successfully');
  } catch (error) {
    next(error);
  }
};

// Scenario 2: Retrieve all posts of a particular user with a single aggregation pipeline using $lookup
const getUserPosts = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);

    // The $match + $sort inside $lookup use the { author: 1, createdAt: -1 } index on posts.
    const pipeline = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id)
        }
      },
      {
        $lookup: {
          from: 'posts',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$author', '$$userId'] }
              }
            },
            {
              $sort: { createdAt: -1 }
            },
            {
              $facet: {
                data: [
                  { $skip: skip },
                  { $limit: limit },
                  { $project: { __v: 0 } }
                ],
                total: [{ $count: 'count' }]
              }
            }
          ],
          as: 'result'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          posts: {
            $let: {
              vars: { facetObj: { $arrayElemAt: ['$result', 0] } },
              in: { $ifNull: ['$$facetObj.data', []] }
            }
          },
          total: {
            $let: {
              vars: { facetObj: { $arrayElemAt: ['$result', 0] } },
              in: {
                $ifNull: [{ $arrayElemAt: ['$$facetObj.total.count', 0] }, 0]
              }
            }
          }
        }
      }
    ];

    const [doc] = await User.aggregate(pipeline);

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return sendPaginated(
      res,
      {
        user: {
          _id: doc._id,
          name: doc.name,
          email: doc.email
        },
        posts: doc.posts
      },
      buildMeta(doc.total, page, limit),
      'User posts retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPost,
  getPostById,
  updatePost,
  deletePost,
  getUserPosts
};
