'use strict';

const { isUuid } = require('./validation');

/**
 * Route-parameter guards (Phase 2B).
 *
 * Every id-keyed route in this application interpolates a URL parameter into a
 * UUID column. When the value is not a UUID, PostgreSQL raises 22P02
 * (`invalid input syntax for type uuid`) from inside the handler's try block,
 * and the handler answers 500. Two consequences, both worth closing:
 *
 *   - A caller can tell "malformed" apart from "does not exist" by status code,
 *     which is a free oracle and an error-based probing channel.
 *   - Ordinary junk in a URL — a truncated id, a scanner's payload — is
 *     reported as a server fault, which buries real faults in noise.
 *
 * Malformed ids answer **404**, the same as an id that exists but belongs to
 * another tenant. A caller therefore learns nothing from the difference.
 *
 * `router.param` fires only for parameters captured by that router's own paths.
 * Routers mounted beneath a parameterised path (`/api/clients/:clientId/...`)
 * receive those values through `mergeParams` instead, so they use
 * `guardInheritedUuidParams` as ordinary middleware.
 */

// Parameter names used across the API that always address a UUID primary key.
const UUID_PARAM_NAMES = [
  'id', 'clientId', 'sessionId', 'trainingId', 'entryId',
  'imageId', 'notificationId', 'groupId', 'packageId', 'paymentId',
];

const notFound = (res) => res.status(404).json({ error: 'Not found' });

/**
 * Validate this router's own UUID parameters before any handler runs.
 *
 * @param {import('express').Router} router
 * @param {string[]} [names]
 * @returns {import('express').Router} the same router, for chaining
 */
const attachUuidParamGuards = (router, names = UUID_PARAM_NAMES) => {
  for (const name of names) {
    router.param(name, (req, res, next, value) =>
      isUuid(value) ? next() : notFound(res)
    );
  }
  return router;
};

/**
 * Validate UUID parameters inherited from a parent mount path.
 *
 * @param {string[]} names
 * @returns {import('express').RequestHandler}
 */
const guardInheritedUuidParams = (names) => (req, res, next) => {
  for (const name of names) {
    const value = req.params?.[name];
    if (value !== undefined && !isUuid(value)) return notFound(res);
  }
  next();
};

module.exports = { attachUuidParamGuards, guardInheritedUuidParams, UUID_PARAM_NAMES };
