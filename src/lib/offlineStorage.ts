import localforage from 'localforage';
import { supabase } from './supabase';

// Define the draft data type
interface DraftData {
    [key: string]: any;
    timestamp: string;
    synced: boolean;
}

// Configure localforage
localforage.config({
    name: 'brihaspathi-fsm',
    version: 1.0,
    storeName: 'offline-data',
});

// Save complaint draft offline
export const saveOfflineDraft = async (complaintId: string, data: any): Promise<boolean> => {
    try {
        await localforage.setItem(`draft-${complaintId}`, {
            ...data,
            timestamp: new Date().toISOString(),
            synced: false,
        });
        console.log('💾 Draft saved offline');
        return true;
    } catch (error) {
        console.error('Failed to save offline draft:', error);
        return false;
    }
};

// Get offline draft
export const getOfflineDraft = async (complaintId: string): Promise<DraftData | null> => {
    try {
        const draft = await localforage.getItem<DraftData>(`draft-${complaintId}`);
        return draft;
    } catch (error) {
        console.error('Failed to get offline draft:', error);
        return null;
    }
};

// Sync offline drafts to Supabase
export const syncOfflineDrafts = async (): Promise<number> => {
    try {
        const keys = await localforage.keys();
        const drafts = await Promise.all(
            keys.map(async (key) => {
                if (key.startsWith('draft-')) {
                    const data = await localforage.getItem<DraftData>(key);
                    return { key, data };
                }
                return null;
            })
        );

        const validDrafts = drafts.filter((d): d is { key: string; data: DraftData } =>
            d !== null && d.data !== null && !d.data.synced
        );

        for (const draft of validDrafts) {
            try {
                const complaintId = draft.key.replace('draft-', '');
                const { synced, timestamp, ...updateData } = draft.data; // Remove synced and timestamp from update

                // Sync to Supabase
                const { error } = await supabase
                    .from('complaints')
                    .update(updateData)
                    .eq('id', complaintId);

                if (!error) {
                    // Mark as synced
                    await localforage.setItem(draft.key, { ...draft.data, synced: true });
                    console.log('✅ Synced draft:', draft.key);
                } else {
                    console.error('Error syncing draft:', error);
                }
            } catch (error) {
                console.error('Failed to sync draft:', draft.key, error);
            }
        }

        return validDrafts.length;
    } catch (error) {
        console.error('Failed to sync offline drafts:', error);
        return 0;
    }
};

// Clear old synced drafts
export const clearSyncedDrafts = async (): Promise<void> => {
    try {
        const keys = await localforage.keys();
        for (const key of keys) {
            if (key.startsWith('draft-')) {
                const data = await localforage.getItem<DraftData>(key);
                if (data && data.synced) {
                    await localforage.removeItem(key);
                    console.log('🗑️ Removed synced draft:', key);
                }
            }
        }
        console.log('🗑️ Cleared synced drafts');
    } catch (error) {
        console.error('Failed to clear synced drafts:', error);
    }
};

// Check if online and sync automatically
export const autoSync = async (): Promise<void> => {
    if (navigator.onLine) {
        console.log('🌐 Online - Syncing offline drafts...');
        await syncOfflineDrafts();
        await clearSyncedDrafts();
    }
};

// Listen for online/offline events
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('🌐 Back online - auto syncing...');
        autoSync();
    });
}