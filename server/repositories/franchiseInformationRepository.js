

const FranchiseInformation = require('../models/franchiseInformationModel');

exports.createFranchiseInformation = async (data) => {
  const franchiseInformation = new FranchiseInformation(data);
  return await franchiseInformation.save();
}

exports.getFranchiseInformationById = async (id) => {
  return await FranchiseInformation.findById(id);        
}

exports.updateFranchiseInformation = async (id, data) => {
  return await FranchiseInformation.findByIdAndUpdate(id, data, { new: true });
}

exports.deleteFranchiseInformation = async (id) => {
  return await FranchiseInformation.findByIdAndDelete(id);
}

