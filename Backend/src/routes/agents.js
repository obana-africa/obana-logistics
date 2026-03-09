const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
// const { authenticate, isAdmin } = require('./auth');

// All agent routes are protected and for admins only.
// If you don't have an isAdmin middleware, you can add a check in each controller.
// router.use(authenticate, isAdmin);

router.get('/', agentController.listAgents);
router.get('/:id', agentController.getAgent);
router.put('/:id', agentController.updateAgent);
router.delete('/:id', agentController.deleteAgent);

module.exports = router;