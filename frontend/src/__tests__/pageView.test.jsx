/**
 * The anonymous page-view beacon.
 *
 * The single most important property here is the one that is easiest to break
 * by accident: **this must not read or write device storage.** The entire
 * argument for running it without a consent banner — while attribution *is*
 * gated — rests on that difference. If someone later adds a "visitor id" in
 * localStorage to deduplicate views, the legal position changes and nothing
 * would fail. So it is asserted directly.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordPageView } from '../utils/pageView';

const setUrl = (path, search = '') =>
  window.history.replaceState({}, '', `${path}${search}`);

let beacons;
let fetches;

beforeEach(() => {
  beacons = [];
  fetches = [];
  navigator.sendBeacon = vi.fn((url, blob) => {
    beacons.push({ url, blob });
    return true;
  });
  global.fetch = vi.fn((url, opts) => {
    fetches.push({ url, opts });
    return Promise.resolve({ ok: true });
  });
  sessionStorage.clear();
  localStorage.clear();
  setUrl('/');
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

/** The JSON actually handed to sendBeacon. */
const sentBody = async () => JSON.parse(await beacons[0].blob.text());

describe('what the beacon sends', () => {
  test('a plain landing view is recorded', async () => {
    recordPageView();

    expect(beacons).toHaveLength(1);
    // Resolved from the configured API base, not a bare /api path.
    expect(beacons[0].url).toMatch(/\/api\/metrics\/view$/);
    expect(await sentBody()).toEqual({ path: '/' });
  });

  test('campaign tags are read off the URL', async () => {
    setUrl('/', '?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=reel-p05');
    recordPageView();

    expect(await sentBody()).toEqual({
      path: '/',
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'organic',
      utm_content: 'reel-p05',
    });
  });

  test('the path is sent without its query string', async () => {
    setUrl('/', '?utm_source=instagram&secret=abc');
    const body = await (recordPageView(), sentBody());

    expect(body.path).toBe('/');
    // The query string is the one part of a URL that can carry something
    // personal, and it is never stored whole.
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('abc');
  });

  test('nothing is sent from an app or admin route', () => {
    for (const path of ['/dashboard', '/dashboard/clients', '/admin', '/admin/trainers']) {
      setUrl(path);
      recordPageView();
    }
    // Counting authenticated navigation would be tracking people around the
    // product, which is a different thing entirely from measuring a funnel.
    expect(beacons).toHaveLength(0);
    expect(fetches).toHaveLength(0);
  });
});

describe('what the beacon refuses to touch', () => {
  test('it neither reads nor writes any device storage', () => {
    const reads = [];
    const writes = [];
    for (const store of [window.localStorage, window.sessionStorage]) {
      vi.spyOn(store, 'getItem').mockImplementation((k) => { reads.push(k); return null; });
      vi.spyOn(store, 'setItem').mockImplementation((k) => { writes.push(k); });
    }

    setUrl('/', '?utm_source=instagram');
    recordPageView();

    // This is the whole basis for not gating it behind the cookie banner.
    expect(reads).toEqual([]);
    expect(writes).toEqual([]);
    expect(document.cookie).toBe('');
  });

  test('it sends no identifier of any kind', async () => {
    setUrl('/', '?utm_source=instagram');
    recordPageView();
    const body = await sentBody();

    for (const key of ['id', 'visitor_id', 'session_id', 'uid', 'fingerprint', 'ip', 'user_agent']) {
      expect(Object.keys(body)).not.toContain(key);
    }
    expect(Object.keys(body).sort()).toEqual(['path', 'utm_source']);
  });

  test('it fires regardless of the cookie decision', async () => {
    // Deliberate, and it is a correctness requirement rather than a liberty:
    // registrations are counted unconditionally, so gating views on consent
    // would divide a consented sample into an unconsented total and overstate
    // every conversion rate by the share of visitors who decline.
    localStorage.setItem(
      'treniko_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, preferences: false })
    );
    recordPageView();
    expect(beacons).toHaveLength(1);
    expect(await sentBody()).toEqual({ path: '/' });
  });
});

describe('it can never break the page', () => {
  test('a throwing sendBeacon falls back to fetch', () => {
    navigator.sendBeacon = vi.fn(() => false);
    expect(() => recordPageView()).not.toThrow();
    expect(fetches).toHaveLength(1);
    expect(fetches[0].url).toMatch(/\/api\/metrics\/view$/);
    expect(fetches[0].opts.keepalive).toBe(true);
  });

  test('a rejected fetch is swallowed', async () => {
    navigator.sendBeacon = vi.fn(() => false);
    global.fetch = vi.fn(() => Promise.reject(new Error('blocked')));

    expect(() => recordPageView()).not.toThrow();
    // An unhandled rejection here would surface in the console of a marketing
    // page, which is exactly the sort of thing a counter must not do.
    await new Promise((r) => setTimeout(r, 10));
  });

  test('no transport at all is not an error', () => {
    navigator.sendBeacon = undefined;
    global.fetch = undefined;
    expect(() => recordPageView()).not.toThrow();
  });
});
