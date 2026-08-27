const express = require('express');
const { authenticateAdmin, checkPermission } = require('../middlewares/auth');
const { listVehicles, createVehicle, updateVehicle, updateVehicleStatus } = require('../controllers/vehicleController');
const router = express.Router();
router.get('/', [authenticateAdmin, checkPermission('tireorder.view')], listVehicles);
router.post('/', [authenticateAdmin, checkPermission('tireorder.create')], createVehicle);
router.patch('/:id', [authenticateAdmin, checkPermission('tireorder.edit')], updateVehicle);
router.patch('/:id/status', [authenticateAdmin, checkPermission('tireorder.edit')], updateVehicleStatus);
module.exports = { router };
