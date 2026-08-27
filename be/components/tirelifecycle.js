const express = require('express');
const { authenticateAdmin, checkPermission } = require('../middlewares/auth');
const controller = require('../controllers/tireLifecycleController');

const router = express.Router();
router.get('/', [authenticateAdmin, checkPermission('tirelifecycle.view')], controller.list);
router.get('/:id', [authenticateAdmin, checkPermission('tirelifecycle.view')], controller.detail);

module.exports = { router };
