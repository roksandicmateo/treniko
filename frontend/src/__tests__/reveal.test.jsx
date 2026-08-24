/**
 * The scroll-reveal behaviour on the landing page.
 *
 * This has tests of its own because it is now load-bearing for SEO, and because
 * it cannot be checked in the automation browser: that tab runs backgrounded,
 * and Chrome throttles rAF, scroll events and IntersectionObserver completely
 * while `document.hidden` is true. Measurements taken there are not evidence of
 * anything, so the behaviour is pinned here instead, where the observer is
 * controlled rather than observed.
 *
 * Three properties matter, in this order:
 *
 *   1. **The first render contains no opacity-0.** The homepage is prerendered
 *      into dist/index.html, so whatever the first render produces is what a
 *      crawler is served. Text that is present but invisible is not SEO, it is
 *      the thing search engines penalise.
 *   2. **Content cannot end up stranded invisible.** A block hidden after mount
 *      must be revealable even when the visitor jumps past it in one frame.
 *   3. **Nothing already on screen is hidden.** Hiding what the reader is
 *      looking at, to fade it back in, is a flicker.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import Landing from '../pages/Landing';
import { AuthProvider } from '../context/AuthContext';
import '../i18n.js';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    authAPI: { ...actual.authAPI, validateToken: vi.fn(() => Promise.reject(new Error('none'))) },
  };
});

/** Every observer created during a render, with the options it was given. */
let observers;

const renderLanding = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Landing />
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  observers = [];

  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false, // motion allowed
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

  window.IntersectionObserver = vi.fn().mockImplementation(function (cb, options) {
    this.callback = cb;
    this.options = options;
    this.elements = [];
    this.observe = (el) => this.elements.push(el);
    this.disconnect = vi.fn();
    observers.push(this);
  });

  // jsdom reports every element at 0×0 / top 0, which would read as "already on
  // screen". Report a position below the fold so blocks are hide-candidates.
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    top: 5000, bottom: 5400, left: 0, right: 0, width: 0, height: 400, x: 0, y: 5000,
  }));
  window.innerHeight = 800;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete window.IntersectionObserver;
});

describe('what a crawler is served', () => {
  test('the server-rendered markup contains no invisible text', () => {
    // renderToString, not RTL's render: this is the exact call
    // src/entry-prerender.jsx makes, so this string is what ends up inside
    // <div id="root"> in dist/index.html and what a crawler is served.
    //
    // RTL's render() would be the wrong instrument here — it wraps in act() and
    // flushes effects, so it reports the state *after* the reveal logic has run,
    // which is not what gets written to disk.
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Landing />
        </AuthProvider>
      </MemoryRouter>
    );

    // The assertion the whole prerender depends on. scripts/prerender.mjs fails
    // the build on the same condition; this catches it far earlier.
    expect(html).not.toMatch(/opacity-0/);
    expect(html).toMatch(/opacity-100/);
    expect(html.length).toBeGreaterThan(20000);
  });

  test('the headline and body copy are in that markup, not added later', () => {
    const { container } = renderLanding();
    const text = container.textContent;

    expect(text).toMatch(/Run your personal training business/);
    expect(text).toMatch(/without the admin chaos/);
    // A section from well below the fold — proves the whole page is present,
    // not just the hero.
    expect(text).toMatch(/Questions worth answering/);
  });
});

describe('content cannot be stranded invisible', () => {
  test('a block below the fold hides itself after mount', async () => {
    const { container } = renderLanding();
    await act(async () => {});

    // Now hidden, ready to animate in — but only after the first paint, so the
    // served HTML never carried it.
    expect(container.querySelectorAll('.opacity-0').length).toBeGreaterThan(0);
  });

  test('the observer is configured so a jump past a block still reveals it', async () => {
    renderLanding();
    await act(async () => {});

    expect(observers.length).toBeGreaterThan(0);

    for (const o of observers) {
      const margin = o.options?.rootMargin ?? '';
      const top = parseInt(margin.split(' ')[0], 10);

      // This is the property that matters. With a default (0) top margin,
      // "intersecting" means "on screen", and a block that goes from below the
      // fold to above the viewport in one frame crosses no threshold — no
      // callback, hidden forever. A large positive top margin redefines
      // intersecting as "has reached or passed the reveal line", which a jump
      // does cross.
      expect(top).toBeGreaterThan(10000);
    }
  });

  test('a block is revealed when its observer reports intersection', async () => {
    const { container } = renderLanding();
    await act(async () => {});

    const before = container.querySelectorAll('.opacity-0').length;
    expect(before).toBeGreaterThan(0);

    await act(async () => {
      for (const o of observers) {
        o.callback(o.elements.map((el) => ({ isIntersecting: true, target: el })));
      }
    });

    // Everything that was waiting is now visible, and stays visible.
    expect(container.querySelectorAll('.opacity-0')).toHaveLength(0);
  });
});

describe('nothing already on screen is hidden', () => {
  test('a block in the viewport is left alone and never observed', async () => {
    // Report every block as already on screen.
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      top: 100, bottom: 500, left: 0, right: 0, width: 0, height: 400, x: 0, y: 100,
    }));

    const { container } = renderLanding();
    await act(async () => {});

    // Never hidden, so never a flicker — and no observer was created for it.
    expect(container.querySelectorAll('.opacity-0')).toHaveLength(0);
    expect(observers).toHaveLength(0);
  });

  test('reduced motion disables the effect entirely', async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const { container } = renderLanding();
    await act(async () => {});

    expect(container.querySelectorAll('.opacity-0')).toHaveLength(0);
    expect(observers).toHaveLength(0);
  });

  test('no IntersectionObserver at all still leaves the content visible', async () => {
    delete window.IntersectionObserver;

    const { container } = renderLanding();
    await act(async () => {});

    expect(container.querySelectorAll('.opacity-0')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: /Run your personal training/i })).toBeTruthy();
  });
});
