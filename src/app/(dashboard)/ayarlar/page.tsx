import { createClient } from '@/lib/supabase/server'
import { AyarlarClient } from './ayarlar-client'

export default async function AyarlarPage() {
  const supabase = await createClient()
  const [{ data: settings }, { data: profiles }, { data: suppliers }] = await Promise.all([
    supabase.from('system_settings').select('*').order('key'),
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('suppliers').select('*').order('name'),
  ])

  return <AyarlarClient settings={settings || []} profiles={profiles || []} suppliers={suppliers || []} />
}
