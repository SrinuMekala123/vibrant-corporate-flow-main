import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ('serviceWorker' in navigator) {
  let swRegistration: ServiceWorkerRegistration | null = null;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        swRegistration = registration;
        console.log('✅ Service Worker registered:', registration);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.dispatchEvent(new CustomEvent('sw-update-available', {
                  detail: { registration }
                }));
              }
            });
          }
        });
      })
      .catch(error => {
        console.log('❌ Service Worker registration failed:', error);
      });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log('🔄 Service Worker updated - reloading...');
    window.location.reload();
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'ONLINE') {
      console.log('🟢 Back online - reloading...');
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
