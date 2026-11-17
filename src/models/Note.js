const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
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
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required']
    }
  },
  {
    timestamps: true
  }
);

noteSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

// a user's own notes list, paginated, newest first (also covers owner filter for admin and deleting all notes of a user)
noteSchema.index({ owner: 1, createdAt: -1 });

// admin all-notes list, paginated, newest first
noteSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Note', noteSchema);
