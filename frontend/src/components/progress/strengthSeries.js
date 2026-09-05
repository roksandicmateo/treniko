/**
 * The payload of `GET /api/progress/:clientId/strength`, normalised.
 *
 * ── The contract ─────────────────────────────────────────────────────────────
 *   {
 *     "<exercise name>": {
 *       category: string | null,
 *       entries: [                       // chronological, oldest first
 *         { date, maxWeight, maxReps, estOneRM, totalVolume, setCount }
 *       ]
 *     }
 *   }
 *
 * ── Why this module exists ───────────────────────────────────────────────────
 * The endpoint used to send a bare array per exercise instead. Reading
 * `exercise.entries` on an array does not give you `undefined` — it gives you
 * `Array.prototype.entries`, a *function*, which is truthy, so the usual
 * `|| []` fallback never fires and the next line throws:
 *
 *     TypeError: entries.map is not a function
 *
 * That took the whole Progress → Strength section down behind the error
 * boundary, and `PRSummary` hit it one line later with `.reduce`. The server now
 * sends the documented shape (see the route's contract comment), which is the
 * fix; this normaliser is what stops the *class* of failure coming back.
 *
 * `entries` is accepted only as an OWN array property, so an inherited member
 * can never again be mistaken for data — whatever a future endpoint, a stale
 * cache or a half-written response hands over.
 *
 * @param {unknown} payload the parsed response body
 * @returns {Record<string, {category: string|null, entries: Array<object>}>}
 */
export const toStrengthSeries = (payload) => {
  const out = {};
  if (!payload || typeof payload !== 'object') return out;

  for (const [name, value] of Object.entries(payload)) {
    const entries = Object.prototype.hasOwnProperty.call(value ?? {}, 'entries')
      ? value.entries
      : null;
    out[name] = {
      category: value?.category ?? null,
      entries: Array.isArray(entries) ? entries : [],
    };
  }
  return out;
};

export default toStrengthSeries;
