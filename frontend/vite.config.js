// frontend/vite.config.js — REPLACE your existing file with this
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Test environment for the routing regression suite (`npm test`). jsdom is
  // required because the navigation behaviour those tests assert only exists
  // once the router is actually rendering into a document.
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
  server: {
    // Bind the dev server to the loopback interface only.
    //
    // This is Vite's default, but it is stated explicitly so that exposing the
    // dev server to the network stays a deliberate act. It was originally added
    // to contain a dev-server advisory that had no fix at the time
    // (GHSA-fx2h-pf6j-xcff, `server.fs.deny` bypass on Windows alternate paths,
    // plus the esbuild advisory GHSA-67mh-4wv8-2f99, which let any website send
    // requests to the dev server and read the response).
    //
    // Both are now fixed — Vite 6.4.3 brings esbuild 0.25.x — so this line is no
    // longer the only thing standing between those weaknesses and the network.
    // It stays because the reasoning is unchanged: the dev server has no
    // authentication and serves the project's source, so it has no business
    // listening on anything but loopback by default.
    //
    // A developer who genuinely needs LAN access can still opt in explicitly
    // with `npm run dev -- --host`, which is a conscious choice rather than the
    // default. Production is unaffected: this block configures only the dev
    // server, not `vite build`.
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
