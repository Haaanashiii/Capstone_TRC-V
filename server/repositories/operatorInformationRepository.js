
const operatorInformation = require('../models/operatorInformationModel');

const createOperatorInformation = async (data) => {
  const operatorInformation = new OperatorInformation(data);
  return await operatorInformation.save();
}

const getOperatorInformationById = async (id) => {
  return await OperatorInformation.findById(id);        
}

const updateOperatorInformation = async (id, data) => {
  return await OperatorInformation.findByIdAndUpdate(id, data, { new: true });
}

const deleteOperatorInformation = async (id) => {
  
}


module.exports = {
  createOperatorInformation,
  getOperatorInformationById,
  updateOperatorInformation,
  deleteOperatorInformation
};
