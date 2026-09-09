// import { createClient } from '@supabase/supabase-js';

// let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// // Dynamically handle local network testing (mobile device access via LAN IP)
// if (supabaseUrl && (supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost'))) {
//   const hostname = window.location.hostname;
//   if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
//     supabaseUrl = supabaseUrl.replace('127.0.0.1', hostname).replace('localhost', hostname);
//   }
// }

// if (import.meta.env.DEV) {
//   console.log('🔍 Resolved Supabase URL:', supabaseUrl);
// }

// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
//     auth: {
//         persistSession: true,
//         autoRefreshToken: true,
//         detectSessionInUrl: true,
//         storage: localStorage,
//         flowType: 'pkce', // Add this
//     },
//     global: {
//         headers: {
//             'X-Client-Info': 'supabase-js-web',
//         },
//     },
//     // Don't send credentials with requests
//     realtime: {
//         params: {
//             eventsPerSecond: 10,
//         },
//     },
// });

// export const resolveSupabaseUrl = (url: string | null | undefined): string => {
//   if (!url) return "";
//   if (url.includes('127.0.0.1') || url.includes('localhost')) {
//     const hostname = window.location.hostname;
//     if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
//       return url.replace('127.0.0.1', hostname).replace('localhost', hostname);
//     }
//   }
//   return url;
// };

import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

// Handle localhost/LAN IP dynamically
if (supabaseUrl && (supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost'))) {
  const hostname = window.location.hostname;
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    supabaseUrl = supabaseUrl.replace('127.0.0.1', hostname).replace('localhost', hostname);
  }
}

if (import.meta.env.DEV) {
  console.log('🔍 Resolved Supabase URL:', supabaseUrl);
}

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: localStorage, // Bypasses cookie blocking
        storageKey: 'brihaspathi-auth-token',
        flowType: 'pkce', // More secure, works better with HTTPS
    },
    global: {
        headers: {
            'X-Client-Info': 'brihaspathi-fsm',
        },
        // REMOVED the custom fetch override that was causing the CORS preflight failure
    },
    realtime: {
        enabled: false,
        params: {
            eventsPerSecond: 10,
        },
    },
});

export const resolveSupabaseUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  if (url.includes('127.0.0.1') || url.includes('localhost')) {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return url.replace('127.0.0.1', hostname).replace('localhost', hostname);
    }
  }
  return url;
};