const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose'); 

const userSchema = new mongoose.Schema({
    userId: { type: String, default: uuidv4, unique: true },
    name: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'] 
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { 
        type: String, 
        enum: ['Sangguiniang Bayan','BPLO', 'Operator'],
        required: true 
    },
    status: {
        type: String,
        enum: ['Active', 'Deactivated', 'Pending'],
        default: 'Pending'
    }
});

module.exports = mongoose.model('User', userSchema);