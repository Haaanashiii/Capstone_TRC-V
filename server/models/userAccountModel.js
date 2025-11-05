const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose'); 

const userAccountSchema = new mongoose.Schema({
    userId: { type: String, default: uuidv4, unique: true },
    name: { type: String, required: true },
    // username is required for local accounts. Make the requirement conditional so OAuth users can omit it.
    // NOTE: we DO NOT set `unique: true` here because we declare a schema-level index below
    // with a partialFilterExpression. That gives us full control (we index only documents
    // where username is present and is a string) and avoids duplicate schema index declarations.
    username: { 
        type: String,
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
    password: { type: String, required: function() { return !this.oauthProvider; }, minlength: 8, select: false },
    role: { 
        type: String, 
        enum: ['sb-admin','bplo-admin', 'operator'],
        default: 'operator',
        required: true 
    },
    oauthProvider: { type: String },
    oauthId: { type: String },
    googleId: { type: String }
    ,
   
    franchiseStatus: { type: String, enum: ['active', 'expired', 'inactive'], default: 'inactive' },
    operatorId: { type: String },
    address: { type: String },
    phoneNumber: { type: String },
    profilePicture: { type: String }
    ,

    approvedAt: { type: Date },
    expiryDate: { type: Date }
    
});

// Unique partial index for username: only index documents where `username` exists and is a string.
// This is preferred over `sparse: true` because it is explicit and avoids surprises with null
// or non-string values. It also prevents duplicate schema index declarations when field-level
// `unique: true` is not used.
userAccountSchema.index(
    { username: 1 },
    { unique: true, partialFilterExpression: { username: { $type: 'string' } } }
);


userAccountSchema.index({ oauthProvider: 1, oauthId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User Accounts', userAccountSchema);