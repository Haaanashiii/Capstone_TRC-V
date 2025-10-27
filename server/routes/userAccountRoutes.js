const express = require('express');
const router = express.Router();
const userAccountController = require('../controllers/userAccountController');

router.get('/', userAccountController.getAllUsers);
router.post('/', userAccountController.createUserAccount);
router.put('/:id', userAccountController.updateUserAccount);
router.delete('/:id', userAccountController.deleteUserAccount);

module.exports = router;
