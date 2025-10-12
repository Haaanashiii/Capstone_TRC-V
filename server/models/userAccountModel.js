const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose'); 

const userAccountSchema = new mongoose.Schema({
    userId: { type: String, default: uuidv4, unique: true },
    name: { type: String, required: true },
    // username is required for local accounts. Make the requirement conditional so OAuth users can omit it.
    username: { 
        type: String, 
        unique: true,
        required: function() { return !this.oauthProvider; }
    },
    email: { 
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
    },
    // password required only for local accounts (no oauthProvider)
    password: { type: String, required: function() { return !this.oauthProvider; }, minlength: 8, select: false },
    role: { 
        type: String, 
        enum: ['Sangguiniang Bayan','BPLO', 'Operator'],
        default: 'Operator',
        required: true 
    },
    status: {
        type: String,
        enum: ['Active', 'Deactivated', 'Pending'],
        default: 'Pending'
    },
    // OAuth provider info (google, auth0, etc.)
    oauthProvider: { type: String },
    oauthId: { type: String },
    // legacy/google-specific id used in controller; keep for compatibility
    googleId: { type: String }
    
});

// Sparse unique index for username so multiple OAuth-only users without username are allowed.
userAccountSchema.index({ username: 1 }, { unique: true, sparse: true });

// Ensure a unique (sparse) index for oauth provider + oauth id so OAuth
// accounts are uniquely identifiable by provider and provider-specific id.
userAccountSchema.index({ oauthProvider: 1, oauthId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User Accounts', userAccountSchema);