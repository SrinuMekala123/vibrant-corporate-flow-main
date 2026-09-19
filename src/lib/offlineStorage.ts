import localforage from 'localforage';

// Configure localforage instance
localforage.config({
    name: 'brihaspathi-fsm',
    version: 1.0,
    storeName: 'offline-data',
});

// Clear any residual drafts once on startup to clean up user storage
if (typeof window !== 'undefined') {
    try {
        localforage.keys().then((keys) => {
            keys.forEach((key) => {
                if (key.startsWith('draft-')) {
                    localforage.removeItem(key).catch(() => {});
                }
            });
        }).catch(() => {});
    } catch {
        // Ignore in environments where storage is unavailable
    }
}