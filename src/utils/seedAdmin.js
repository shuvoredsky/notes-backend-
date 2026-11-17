require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in .env');
  }

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be defined in .env');
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);

    const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL.toLowerCase().trim() });
    if (existingAdmin) {
      console.log('Admin already exists');
      return;
    }

    await User.create({
      name: 'System Admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin'
    });

    console.log('Admin user created successfully');
  } catch (error) {
    console.error('Failed to seed admin:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

if (require.main === module) {
  seedAdmin();
}

module.exports = seedAdmin;

