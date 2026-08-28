// import { createRoot } from "react-dom/client";
// import App from "./App.tsx";
// import "./index.css";

// createRoot(document.getElementById("root")!).render(<App />);


import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Development-only: forcefully unregister any existing Service Workers to avoid Vite HMR interception
if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => {
      reg.unregister().then((success) => {
        if (success) console.log('🗑️ Unregistered Service Worker:', reg.scope);
      });
    });
    // Clear any leftover caches to avoid stale service worker assets
    if (caches && caches.keys) {
      caches.keys().then((keys) => {
        Promise.all(keys.map((key) => caches.delete(key))).then(() => {
          console.log('🧹 Cleared all caches in dev mode');
        });
      });
    }
  });
}

// Register Service Worker only in production builds
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered (prod):', registration);
        // Force immediate activation of updates
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 New update available - refresh to update');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('❌ Service Worker registration failed:', error);
      });
  });
}


// Listen for messages from service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'ONLINE') {
            console.log('🟢 Back online - reloading...');
            window.location.reload();
        }
    });
}

createRoot(document.getElementById("root")!).render(<App />);