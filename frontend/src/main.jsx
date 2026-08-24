import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './i18n.js'
import './index.css'
import { ThemeProvider } from './context/ThemeContext.jsx'

const container = document.getElementById('root')

const tree = (
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)

// `/` is prerendered at build time into dist/index.html — see
// scripts/prerender.mjs. Every other route is served the bare shell in
// dist/app.html, so the container is empty there.
//
// Hydrating rather than re-rendering is what makes the prerender worth having:
// createRoot would throw the server markup away and repaint, which is a visible
// flash and gives up the faster first paint. Deciding on the container's actual
// contents rather than on the path means this stays correct if the set of
// prerendered pages ever changes, and it degrades safely — an empty container
// simply takes the createRoot branch, which is the behaviour that shipped
// before this existed.
if (container.firstElementChild) {
  ReactDOM.hydrateRoot(container, tree)
} else {
  ReactDOM.createRoot(container).render(tree)
}
