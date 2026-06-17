// import { createClient } from '@supabase/supabase-js'

// // Debug: Log environment variables on load (only in development)
// if (import.meta.env.DEV) {
//     console.log('🔍 Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
//     console.log('🔑 Supabase Anon Key loaded:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
// }

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// if (!supabaseUrl || !supabaseAnonKey) {
//     console.error('❌ Missing Supabase credentials!')
//     console.error('Check your .env file has:')
//     console.error('VITE_SUPABASE_URL=your_project_url')
//     console.error('VITE_SUPABASE_ANON_KEY=your_anon_key')
// }

// export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
//     auth: {
//         autoRefreshToken: true,
//         persistSession: true,
//         detectSessionInUrl: true,
//     },
//     global: {
//         // Add retry logic for network issues
//         fetch: (url, options) => {
//             return fetch(url, {
//                 ...options,
//                 // Add timeout to prevent hanging requests
//                 signal: AbortSignal.timeout(10000),
//             })
//         },
//     },
// })

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: localStorage,
        flowType: 'pkce', // Add this
    },
    global: {
        headers: {
            'X-Client-Info': 'supabase-js-web',
        },
    },
    // Don't send credentials with requests
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});