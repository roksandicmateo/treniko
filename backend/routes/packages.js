const express = require('express');
const router = express.Router();
const clientRouter = express.Router({ mergeParams: true });
const {
  getPackages, getPackage, createPackage, updatePackage, deletePackage,
  getClientPackages, getActiveClientPackage, assignPackage,
  updateClientPackage, useSession
} = require('../controllers/packagesController');
const { authenticateToken } = require('../middleware/auth');
const { attachUuidParamGuards, guardInheritedUuidParams } = require('../utils/routeGuards');
const { requireDpa } = require('../middleware/requireDpa');

router.use(authenticateToken, requireDpa);
attachUuidParamGuards(router);
clientRouter.use(authenticateToken, requireDpa);

// A malformed UUID in the path answers 404 instead of reaching PostgreSQL
// and surfacing as a 500. These routers are mounted beneath a
// parameterised path, so the inherited ids are checked as middleware while
// the router's own ids go through router.param (see utils/routeGuards.js).
attachUuidParamGuards(clientRouter);
clientRouter.use(guardInheritedUuidParams(['clientId']));

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