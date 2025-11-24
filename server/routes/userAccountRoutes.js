const express = require('express');
const router = express.Router();
const userAccountController = require('../controllers/userAccountController');

// GET user account by email (for verification modal)
router.get('/account', userAccountController.findAccountByEmail);

// GET all users (with optional role filter)
router.get('/', userAccountController.getAllUserAccounts);

// GET user by ID
router.get('/:id', userAccountController.getUserAccountById);

router.post('/', userAccountController.createUserAccount);
router.put('/:id', userAccountController.updateUserAccount);
router.delete('/:id', userAccountController.deleteUserAccount);

module.exports = router;
