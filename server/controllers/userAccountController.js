const userAccountRepository = require('../repositories/userAccountRepository');

exports.getAllUsers = async (req, res, next) => {
  try {
    const User = require('../models/userAccountModel');
    
    // Option to populate operator info and franchises if includeOperator query param is true
    const includeOperator = req.query.includeOperator === 'true';
    
    let users;
    if (includeOperator) {
      users = await User.find({}).select('-password').populate({
        path: 'operatorInfo',
        populate: {
          path: 'franchiseInformations'
        }
      }).lean();
    } else {
      users = await userAccountRepository.getAllUsers();
    }
    
    // Don't return passwords in response
    const usersResponse = users.map(user => ({
      _id: user._id,
      userId: user.userId,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      oauthProvider: user.oauthProvider,
      operatorInfo: user.operatorInfo || null // Include operator info if populated
    }));
    
    res.status(200).json(usersResponse);
  } catch (err) {
    next(err);
  }
};

exports.createUserAccount = async (req, res, next) => {
  try {
    const { name, username, email, password } = req.body;
    
    // Basic validation
    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Check if user already exists
    const existingUserByEmail = await userAccountRepository.findAccountByEmail(email);
    if (existingUserByEmail) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    const existingUserByUsername = await userAccountRepository.findAccountByUsername(username);
    if (existingUserByUsername) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    
    const user = await userAccountRepository.createUserAccount(req.body);
    
    // Don't return password in response
    const userResponse = {
      userId: user.userId,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status
    };
    
    res.status(201).json({ 
      message: 'Account created successfully', 
      user: userResponse 
    });
  } catch (err) {
    if (err.code === 11000) {
      // Handle MongoDB duplicate key error
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ error: `${field} already exists` });
    }
    next(err);
  }
};

exports.updateUserAccount = async (req, res, next) => {
  try {
    const user = await userAccountRepository.updateUserAccount(req.params.id, req.body);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Don't return password in response
    const userResponse = {
      userId: user.userId,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status
    };
    
    res.status(200).json(userResponse);
  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    next(err);
  }
};

exports.deleteUserAccount = async (req, res, next) => {
  try {
    await userAccountRepository.deleteUserAccount(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    next(err);
  }
};

exports.getUserAccountById = async (req, res, next) => {
  try {
    const User = require('../models/userAccountModel');
    
    // Option to populate operator info and franchises if includeOperator query param is true
    const includeOperator = req.query.includeOperator === 'true';
    
    let user;
    if (includeOperator) {
      user = await User.findOne({ userId: req.params.id }).populate({
        path: 'operatorInfo',
        populate: {
          path: 'franchiseInformations'
        }
      }) || await User.findById(req.params.id).populate({
        path: 'operatorInfo',
        populate: {
          path: 'franchiseInformations'
        }
      });
    } else {
      user = await userAccountRepository.findAccountById(req.params.id);
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

exports.findAccountByEmail = async (req, res, next) => {
  try {
    const user = await userAccountRepository.findAccountByEmail(req.query.email, { lean: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

exports.findAccountByUsername = async (req, res, next) => {
  try {
    const user = await userAccountRepository.findAccountByUsername(req.query.username, { lean: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

exports.getAllUserAccounts = async (req, res, next) => {
  try {
    // Filter to get only sb-admin and bplo-admin users
    const users = await userAccountRepository.findAccountsByRoles(['sb-admin', 'bplo-admin']);
    
    // Don't return passwords
    const usersResponse = users.map(user => ({
      userId: user.userId,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      oauthProvider: user.oauthProvider
    }));
    
    res.status(200).json(usersResponse);
  } catch (err) {
    next(err);
  }
};