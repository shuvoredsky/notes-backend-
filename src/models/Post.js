const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required']
    }
  },
  {
    timestamps: true
  }
);

postSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

// posts of one user, newest first; used by the $lookup pipeline in Scenario 2 and by deleting all posts of a user
postSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
