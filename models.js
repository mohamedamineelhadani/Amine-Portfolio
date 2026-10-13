const { Schema, model } = require('mongoose');

const Message = model('Message', new Schema({
  name:    { type: String, required: true, maxlength: 100 },
  email:   { type: String, required: true, maxlength: 150, lowercase: true },
  message: { type: String, required: true, maxlength: 3000 },
  read:    { type: Boolean, default: false },
  ip:      String,
}, { timestamps: true }));

const Admin = model('Admin', new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  hash:  { type: String, required: true },
}, { timestamps: true }));

module.exports = { Message, Admin };
