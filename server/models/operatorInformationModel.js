const mongoose = require('mongoose');

const operatorInformationSchema = new mongoose.Schema({
    operatorId: { type: String, required: true, unique: true },
    operatorName: { type: String, required: true },
    operatorContactNumber: { type: String, required: true, trim: true },
    operatorEmail: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] },
    operatorAddress: { type: String, required: true },
    operatorcivilStatus: { type: String, required: true },
    operatorBirthPlace: { type: String, required: true },
    operatorBirthDate: { type: Date, required: true },
    operatorCitizenship: { type: String, required: true },
    email: { type: String, required: false, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email address'] }, 
    totalFranchises: { type: Number, required: true, default: 0 },
    franchiseInformations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Franchise Information',   
        default: null
    }]  
}, { collection: 'Operator Informations' });

module.exports = mongoose.model('Operator Information', operatorInformationSchema);