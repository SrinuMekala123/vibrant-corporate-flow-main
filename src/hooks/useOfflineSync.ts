import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useOfflineSync = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingSync, setPendingSync] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Back online! Syncing data...');
            setPendingSync(true);

            // Trigger sync for pending data
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SYNC' });
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.warning('You are offline - changes will sync when online');
            setPendingSync(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline, pendingSync };
};