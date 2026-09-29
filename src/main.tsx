// import { createRoot } from "react-dom/client";
// import App from "./App.tsx";
// import "./index.css";

// createRoot(document.getElementById("root")!).render(<App />);


import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Register Service Worker to enable PWA installation on Desktop, Laptop, and Mobile
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered for PWA:', registration.scope);
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
        console.warn('⚠️ Service Worker note (expected if HTTP LAN origin):', error.message);
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