const express = require('express');
const router = express.Router();
const clientRouter = express.Router({ mergeParams: true });
const {
  getPackages, getPackage, createPackage, updatePackage, deletePackage,
  getClientPackages, getActiveClientPackage, assignPackage,
  updateClientPackage, useSession
} = require('../controllers/packagesController');
const { authenticateToken } = require('../middleware/auth');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);
clientRouter.use(authenticateToken, requireDpa);

// Package templates — mounted at /api/packages
router.get('/',       getPackages);
router.post('/',      createPackage);
router.get('/:id',    getPackage);
router.put('/:id',    updatePackage);
router.delete('/:id', deletePackage);

// Client packages — mounted at /api/clients/:clientId
clientRouter.get( '/packages',              getClientPackages);
clientRouter.get( '/packages/active',       getActiveClientPackage);
clientRouter.post('/packages',              assignPackage);
clientRouter.put( '/packages/:id',          updateClientPackage);
clientRouter.post('/packages/:id/use-session', useSession);

module.exports = { router, clientRouter };