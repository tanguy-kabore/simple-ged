const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflowController');
const { authenticate, authorize, checkPermission } = require('../middleware/auth');

router.use(authenticate);

// Templates de workflow
router.get('/', workflowController.getWorkflows);
router.post('/', authorize('admin', 'manager'), workflowController.createWorkflow);
router.get('/:id', workflowController.getWorkflow);

// Instances de workflow
router.post('/start', checkPermission('workflows', 'participate'), workflowController.startWorkflow);
router.get('/tasks/my', workflowController.getMyTasks);
router.post('/instances/:instanceId/process', workflowController.processStep);
router.get('/instances/:instanceId/history', workflowController.getWorkflowHistory);
router.post('/instances/:instanceId/cancel', workflowController.cancelWorkflow);

module.exports = router;
