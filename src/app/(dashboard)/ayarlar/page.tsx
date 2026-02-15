import { createClient } from '@/lib/supabase/server'
import { AyarlarClient } from './ayarlar-client'

export default async function AyarlarPage() {
  const supabase = await createClient()
  const { data: settings } = await supabase.from('system_settings').select('*').order('key')
  const { data: profiles } = await supabase.from('profiles').select('*').order('full_name')
  const { data: suppliers } = await supabase.from('suppliers').select('*').order('name')

  return <AyarlarClient settings={settings || []} profiles={profiles || []} suppliers={suppliers || []} />
}
