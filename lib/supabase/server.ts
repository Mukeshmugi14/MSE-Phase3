import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(toSet: { name: string, value: string, options: any }[]) {
        try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
        catch {}
      },
    },
  })
}

export async function createAdminClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder'
  
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(toSet: { name: string, value: string, options: any }[]) {
        try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
        catch {}
      },
    },
  })
}
