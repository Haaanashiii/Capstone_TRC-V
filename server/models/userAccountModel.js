const { uuidv7 } = require('uuidv7');
const mongoose = require('mongoose'); 

const userAccountSchema = new mongoose.Schema({
    userId: { type: String, default: uuidv7, unique: true },
    name: { type: String, required: true },
    username: { 
        type: String,
        required: true
    },
    phoneNumber: { type: String },
    email: { 
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { 
        type: String, 
        default: 'operator',
        required: true 
    },

    franchiseApplications: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Franchise Application'
    }],
    franchiseInformation: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Franchise Information'
    }]
    
});

module.exports = mongoose.model('User Accounts', userAccountSchema);