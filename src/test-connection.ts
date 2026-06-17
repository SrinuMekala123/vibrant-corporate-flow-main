import { supabase } from './lib/supabase'

export async function testConnection() {
    console.log('🔍 Testing Supabase connection...')

    try {
        // Test 1: Check if client is initialized
        if (!supabase) {
            console.error('❌ Supabase client not initialized')
            return false
        }

        // Test 2: Try to fetch from profiles table
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .limit(1)

        if (error) {
            console.error('❌ Database query failed:', {
                message: error.message,
                code: error.code,
                hint: error.hint,
                details: error.details
            })
            return false
        }

        console.log('✅ Database connection successful!')
        console.log('📊 Sample data:', data)

        // Test 3: Check auth status
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        if (authError) {
            console.warn('⚠️ Auth session check failed:', authError.message)
        } else {
            console.log('🔐 Auth session:', session ? 'Active' : 'None')
        }

        return true
    } catch (err) {
        console.error('❌ Connection test failed:', {
            name: err instanceof Error ? err.name : 'Unknown',
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
        })
        return false
    }
}

// Auto-run test in development
if (import.meta.env.DEV) {
    testConnection()
}