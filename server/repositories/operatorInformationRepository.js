
const operatorInformation = require('../models/operatorInformationModel');

exports.createOperatorInformation = async (data) => {
  const operatorInformation = new OperatorInformation(data);
  return await operatorInformation.save();
}

exports.getOperatorInformationById = async (id) => {
  return await OperatorInformation.findById(id);        
}

exports.updateOperatorInformation = async (id, data) => {
  return await OperatorInformation.findByIdAndUpdate(id, data, { new: true });
}

exports.deleteOperatorInformation = async (id) => {
  
}


