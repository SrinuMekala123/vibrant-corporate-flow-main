// // src/lib/realtime.ts
// import { supabase } from './supabase';
// import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// type ComplaintPayload = RealtimePostgresChangesPayload<any>;

// // Subscribe to a specific complaint by ID
// export const subscribeToComplaint = (
//     complaintId: string,
//     onChanges: (payload: ComplaintPayload) => void
// ) => {
//     const channel = supabase
//         .channel(`complaint-${complaintId}`)
//         .on(
//             'postgres_changes',
//             {
//                 event: '*', // Listen to INSERT, UPDATE, DELETE
//                 schema: 'public',
//                 table: 'complaints',
//                 filter: `id=eq.${complaintId}`,
//             },
//             (payload) => {
//                 console.log(`🔄 Realtime update for complaint ${complaintId}:`, payload.eventType);
//                 onChanges(payload);
//             }
//         )
//         .subscribe((status) => {
//             console.log(`📡 Subscription status for complaint ${complaintId}:`, status);
//         });

//     return channel;
// };

// // Subscribe to all complaints (for list view)
// export const subscribeToAllComplaints = (
//     onChanges: (payload: ComplaintPayload) => void
// ) => {
//     const channel = supabase
//         .channel('complaints-list')
//         .on(
//             'postgres_changes',
//             {
//                 event: '*',
//                 schema: 'public',
//                 table: 'complaints',
//             },
//             (payload) => {
//                 console.log('🔄 Realtime update for complaints list:', payload.eventType);
//                 onChanges(payload);
//             }
//         )
//         .subscribe();

//     return channel;
// };

// // Unsubscribe from specific channel
// export const unsubscribeFromChannel = async (channel: any) => {
//     if (channel) {
//         await supabase.removeChannel(channel);
//         console.log('🔌 Unsubscribed from channel');
//     }
// };

// // Unsubscribe from all channels (use with caution)
// export const unsubscribeFromAll = async () => {
//     // This is a utility - you typically want to track specific channels
//     console.log('⚠️ unsubscribeFromAll called - make sure you have channel references');
// };

// src/lib/realtime.ts
import { supabase } from './supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ComplaintPayload = RealtimePostgresChangesPayload<any>;

// 🔥 FIXED: Subscribe to a specific complaint by ID with retry logic
export const subscribeToComplaint = (
    complaintId: string,
    onChanges: (payload: ComplaintPayload) => void
) => {
    let retryCount = 0;
    const maxRetries = 5;
    let channel: any = null;

    const setupSubscription = () => {
        channel = supabase
            .channel(`complaint-${complaintId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'complaints',
                    filter: `id=eq.${complaintId}`,
                },
                (payload: ComplaintPayload) => {
                    console.log(`🔄 Realtime update for complaint ${complaintId}:`, payload.eventType);
                    retryCount = 0; // Reset on successful message
                    onChanges(payload);
                }
            )
            .subscribe((status: string, err: any) => {
                console.log(`📡 Subscription status for complaint ${complaintId}:`, status);

                if (status === 'CHANNEL_ERROR') {
                    console.error(`❌ Channel error for complaint ${complaintId}:`, err);
                    retryCount++;

                    if (retryCount <= maxRetries) {
                        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                        console.log(`🔄 Retrying connection in ${delay}ms (${retryCount}/${maxRetries})...`);

                        setTimeout(() => {
                            if (channel) {
                                supabase.removeChannel(channel);
                                setupSubscription();
                            }
                        }, delay);
                    } else {
                        console.error(`❌ Max retries reached for complaint ${complaintId}`);
                    }
                } else if (status === 'SUBSCRIBED') {
                    retryCount = 0;
                    console.log(`✅ Successfully subscribed to complaint ${complaintId}`);
                } else if (status === 'CLOSED') {
                    console.log(`🔒 Subscription closed for complaint ${complaintId}`);
                }
            });
    };

    setupSubscription();

    return {
        channel,
        unsubscribe: async () => {
            if (channel) {
                await supabase.removeChannel(channel);
                console.log(`🔌 Unsubscribed from complaint ${complaintId}`);
            }
        }
    };
};

// 🔥 FIXED: Subscribe to all complaints (for list view) with retry logic
export const subscribeToAllComplaints = (
    onChanges: (payload: ComplaintPayload) => void
) => {
    let retryCount = 0;
    const maxRetries = 5;
    let channel: any = null;

    const setupSubscription = () => {
        channel = supabase
            .channel('complaints-list')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'complaints',
                },
                (payload: ComplaintPayload) => {
                    console.log('🔄 Realtime update for complaints list:', payload.eventType);
                    retryCount = 0;
                    onChanges(payload);
                }
            )
            .subscribe((status: string, err: any) => {
                console.log('📡 Complaints list subscription status:', status);

                if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Channel error for complaints list:', err);
                    retryCount++;

                    if (retryCount <= maxRetries) {
                        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                        console.log(`🔄 Retrying complaints list connection in ${delay}ms (${retryCount}/${maxRetries})...`);

                        setTimeout(() => {
                            if (channel) {
                                supabase.removeChannel(channel);
                                setupSubscription();
                            }
                        }, delay);
                    } else {
                        console.error('❌ Max retries reached for complaints list');
                    }
                } else if (status === 'SUBSCRIBED') {
                    retryCount = 0;
                    console.log('✅ Successfully subscribed to complaints list');
                } else if (status === 'CLOSED') {
                    console.log('🔒 Complaints list subscription closed');
                }
            });
    };

    setupSubscription();

    return {
        channel,
        unsubscribe: async () => {
            if (channel) {
                await supabase.removeChannel(channel);
                console.log('🔌 Unsubscribed from complaints list');
            }
        }
    };
};

// Unsubscribe from specific channel
export const unsubscribeFromChannel = async (channel: any) => {
    if (channel) {
        await supabase.removeChannel(channel);
        console.log('🔌 Unsubscribed from channel');
    }
};

// Unsubscribe from all channels (use with caution)
export const unsubscribeFromAll = async () => {
    console.log('⚠️ unsubscribeFromAll called - make sure you have channel references');
};