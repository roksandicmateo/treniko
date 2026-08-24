'use strict';

/**
 * Public, anonymous page-view counter — migration 035.
 *
 * One endpoint, one job: count that a public marketing page was viewed, and
 * which channel sent the visitor. It exists to supply the denominator that
 * `signup_attribution` cannot — see the migration for why this is a table in
 * our own database rather than Umami or Plausible.
 *
 * It is deliberately NOT called /api/analytics/*. That is not evasion: the
 * endpoint stores no cookie, no identifier and nothing about the person, so
 * there is no user choice being circumvented. It is that several content
 * blockers match the literal substring "analytics" in a URL, and a blocked
 * request produces an undercounted denominator, which silently overstates
 * every conversion rate computed from it. Some blockers will still block this
 * by other heuristics, so the figures are a floor, not a census — and the
 * admin panel says so.
 */

const express = require('express');
const { recordPageView } = require('../utils/pageView');

const router = express.Router();

/**
 * POST /api/metrics/view
 *
 * Answers 204 unconditionally. The browser is not told whether the row was
 * written, because there is nothing it could usefully do about it and an error
 * here must never become a visible failure on a marketing page.
 */
router.post('/view', async (req, res) => {
  // Not awaited for the response, but awaited before the handler returns, so
  // an integration test can assert the row exists without polling.
  await recordPageView(req.body);
  return res.status(204).end();
});

module.exports = router;
