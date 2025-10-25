import { createClient } from '@supabase/supabase-js'

// These will be set in your .env file and processed by Vite
// Vite exposes env variables with VITE_ prefix to the client
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

console.log('Supabase config check:')
console.log('- VITE_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Not set')
console.log('- VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set' : '✗ Not set')

// Create a single supabase client for the entire application
// Only create client if credentials are provided
let supabase = null
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey)
    console.log('✅ Supabase client initialized successfully')
  } catch (error) {
    console.error('Failed to create Supabase client:', error.message)
  }
} else {
  console.warn('Supabase credentials not found. Skipping Supabase client creation.')
}

export { supabase }