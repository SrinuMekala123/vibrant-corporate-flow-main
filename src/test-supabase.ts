import { supabase } from './lib/supabase'

export async function testSupabaseConnection() {
    try {
        // ✅ CORRECT URL (no extra "r")
        const response = await fetch('https://zwjxvvjqsobmfarxybyz.supabase.co', {
            method: 'GET',
            mode: 'cors',
        });
        console.log('✅ Connection successful:', response.status);
        return true;
    } catch (error) {
        console.error('❌ Connection failed:', error);
        return false;
    }
}