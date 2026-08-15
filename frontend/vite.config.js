// frontend/vite.config.js — REPLACE your existing file with this
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind the dev server to the loopback interface only.
    //
    // This is Vite's default, but it is stated explicitly because the installed
    // Vite (5.4.21) carries an unfixed advisory affecting the DEV SERVER on
    // Windows (GHSA-fx2h-pf6j-xcff, `server.fs.deny` bypass via alternate
    // paths). Keeping the socket on localhost means that weakness is not
    // reachable from the network. The fix requires Vite 8.x, a breaking upgrade
    // deliberately deferred.
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
