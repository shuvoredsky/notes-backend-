const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
