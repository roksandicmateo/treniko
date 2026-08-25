import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { captureAttribution } from '../utils/attribution';

/**
 * Captures first-touch signup attribution on whichever route the visitor lands.
 *
 * ── The bug this fixes ───────────────────────────────────────────────────────
 * `captureAttribution()` was called from exactly one place: the landing page.
 * That was correct when `/` was the only way into the app, and it silently
 * stopped being correct the moment the content pages shipped.
 *
 * The path every planned acquisition channel actually takes:
 *
 *   Instagram bio → /free-personal-trainer-client-tracker?utm_source=instagram
 *                 → the static page's beacon appends the UTMs to its
 *                   `href="/register"` CTA
 *                 → /register?utm_source=instagram
 *                 → Register renders. Landing never mounts.
 *                 → captureAttribution() never runs.
 *                 → sessionStorage is empty.
 *                 → AuthContext.register() reads null and sends no attribution.
 *                 → the signup is recorded as unattributed.
 *
 * So every trainer arriving from the free tracker, the calculator, any guide,
 * the Instagram bio link or a directory listing would have landed in
 * `(unattributed)` — and the funnel-by-source that the whole measurement effort
 * exists to produce would have reported nothing for the channels actually in
 * use. The failure is silent: no error, no warning, just a blank column.
 *
 * ── Why a separate component ─────────────────────────────────────────────────
 * PageViewTracker sits beside this and is mounted the same way. They are kept
 * apart deliberately, for the reason its own comment gives: they answer to
 * different things, and a change to one must never be able to break the other.
 * This one is about who to credit for a signup; that one is about counting a
 * view.
 *
 * ── Why keying on pathname is safe ───────────────────────────────────────────
 * `captureAttribution()` is first-touch and idempotent: it returns any existing
 * record untouched rather than overwriting it. Running on every navigation
 * therefore cannot overwrite the original source with a later one — it only
 * gives the first landing a chance to be recorded no matter which route it was.
 *
 * ── What is deliberately unchanged ───────────────────────────────────────────
 * The consent gate. `captureAttribution()` writes nothing without analytics
 * consent, and that stays exactly as it is. Wider capture is a correctness fix;
 * it is not a reason to start storing more about people who declined.
 */
export default function AttributionCapture() {
  const { pathname } = useLocation();

  useEffect(() => {
    captureAttribution();
  }, [pathname]);

  return null;
}
