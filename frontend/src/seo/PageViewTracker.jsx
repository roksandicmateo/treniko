import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordPageView } from '../utils/pageView';

/**
 * Fires the anonymous page-view beacon once per public route view.
 *
 * Kept separate from RouteMeta rather than folded into its effect, even though
 * both run on the same navigation. They answer to different things: RouteMeta
 * is about what crawlers are told, this is about what the funnel can measure,
 * and a change to one should never be able to silently break the other.
 *
 * Mounted once, inside the router. The effect keys on `pathname` only —
 * deliberately not on the query string, so re-reading the same page with a
 * different UTM tag does not double-count, and a state change that rewrites
 * the query does not count at all.
 *
 * All the reasoning about consent, and about what is deliberately not
 * collected, lives in utils/pageView.js.
 */
export default function PageViewTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    recordPageView();
  }, [pathname]);

  return null;
}
