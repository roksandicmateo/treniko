// backend/routes/payments.js
'use strict';

const express = require('express');

// Two routers — one scoped to /api/clients/:clientId, one to /api/billing
const clientRouter  = express.Router({ mergeParams: true });
const billingRouter = express.Router();

const {
  getClientPayments,
  createPayment,
  updatePayment,
  deletePayment,
  getBillingSummary,
} = require('../controllers/paymentsController');

const { authenticateToken } = require('../middleware/auth');
const { requireDpa }        = require('../middleware/requireDpa');

// Apply auth + DPA to both routers
clientRouter.use(authenticateToken, requireDpa);
billingRouter.use(authenticateToken, requireDpa);

// ── /api/clients/:clientId/payments ──────────────────────────────────────────
clientRouter.get('/',       getClientPayments);
clientRouter.post('/',      createPayment);
clientRouter.put('/:id',    updatePayment);
clientRouter.delete('/:id', deletePayment);

// ── /api/billing ──────────────────────────────────────────────────────────────
billingRouter.get('/summary', getBillingSummary);

module.exports = { clientRouter, billingRouter };
