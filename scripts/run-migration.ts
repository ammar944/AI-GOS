/**
 * Script to apply migrations via Supabase Management API
 * Usage: SUPABASE_ACCESS_TOKEN=your_token npx tsx --env-file=.env.local scripts/run-migration.ts
 *
 * To get your access token:
 * 1. Go to https://supabase.com/dashboard/account/tokens
 * 2. Generate a new access token
 * 3. Set it as SUPABASE_ACCESS_TOKEN environment variable
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const accessToken = process.env.SUPABASE_ACCESS_TOKEN

// Extract project ref from URL (e.g., https://sidrtuxpqftyzwdusdha.supabase.co -> sidrtuxpqftyzwdusdha)
const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

console.log('Supabase Migration Runner')
console.log('=========================')
console.log(`Project URL: ${supabaseUrl}`)
console.log(`Project Ref: ${projectRef}`)
console.log(`Service Role Key: ${serviceRoleKey ? 'Present' : 'Missing'}`)
console.log(`Access Token: ${accessToken ? 'Present' : 'Missing'}`)
console.log('')

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create admin client for verification
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigrationViaAPI(sql: string, name: string): Promise<boolean> {
  if (!accessToken || !projectRef) {
    console.log('Cannot use Management API - missing access token or project ref')
    return false
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    console.log(`Management API error: ${response.status} - ${error}`)
    return false
  }

  const result = await response.json()
  console.log('Management API response:', JSON.stringify(result, null, 2))
  return true
}

async function verifyTables() {
  console.log('Verifying tables...')
  console.log('---')

  // Check conversations table
  const { data: convData, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .limit(1)

  if (convError) {
    if (convError.message.includes('does not exist') || convError.code === '42P01') {
      console.log('[ ] conversations table: NOT FOUND')
    } else if (convError.message.includes('schema cache')) {
      console.log('[ ] conversations table: NOT IN SCHEMA CACHE (may not exist)')
    } else {
      console.log(`[?] conversations table: ${convError.message}`)
    }
  } else {
    console.log('[x] conversations table: EXISTS')
  }

  // Check chat_messages table
  const { data: msgData, error: msgError } = await supabase
    .from('chat_messages')
    .select('id')
    .limit(1)

  if (msgError) {
    if (msgError.message.includes('does not exist') || msgError.code === '42P01') {
      console.log('[ ] chat_messages table: NOT FOUND')
    } else if (msgError.message.includes('schema cache')) {
      console.log('[ ] chat_messages table: NOT IN SCHEMA CACHE (may not exist)')
    } else {
      console.log(`[?] chat_messages table: ${msgError.message}`)
    }
  } else {
    console.log('[x] chat_messages table: EXISTS')
  }
}

async function runMigration() {
  // Read migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260115_create_chat_tables.sql')

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8')
  console.log(`Migration file loaded: ${migrationPath}`)
  console.log(`SQL length: ${sql.length} characters`)
  console.log('')

  // Try to apply via Management API if token is available
  if (accessToken) {
    console.log('Attempting to apply migration via Supabase Management API...')
    const success = await applyMigrationViaAPI(sql, 'create_chat_tables')
    if (success) {
      console.log('Migration applied successfully via Management API!')
    }
  } else {
    console.log('SUPABASE_ACCESS_TOKEN not set.')
    console.log('')
    console.log('To apply this migration, you have two options:')
    console.log('')
    console.log('Option 1: Use Supabase Dashboard')
    console.log('  1. Go to https://supabase.com/dashboard/project/' + projectRef + '/sql/new')
    console.log('  2. Copy and paste the SQL from the migration file')
    console.log('  3. Click "Run" to execute')
    console.log('')
    console.log('Option 2: Use Management API')
    console.log('  1. Go to https://supabase.com/dashboard/account/tokens')
    console.log('  2. Generate a new access token')
    console.log('  3. Run: SUPABASE_ACCESS_TOKEN=your_token npx tsx --env-file=.env.local scripts/run-migration.ts')
    console.log('')
    console.log('Option 3: Use Supabase CLI')
    console.log('  1. Install: npm install -g supabase')
    console.log('  2. Login: supabase login')
    console.log('  3. Link: supabase link --project-ref ' + projectRef)
    console.log('  4. Push: supabase db push')
  }

  console.log('')
  await verifyTables()
}

runMigration().catch(console.error)
