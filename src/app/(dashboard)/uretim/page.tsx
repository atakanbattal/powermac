import { createClient } from '@/lib/supabase/server'
import { UretimClient } from './uretim-client'

export default async function UretimPage() {
  const supabase = await createClient()

  const [{ data: gearboxes }, { data: profiles }, { data: gearboxModels }] = await Promise.all([
    supabase
      .from('gearboxes')
      .select('*, responsible_user:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['admin', 'production'])
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('gearbox_models').select('id, code, name').eq('is_active', true).order('sort_order'),
  ])

  return <UretimClient gearboxes={gearboxes || []} profiles={profiles || []} gearboxModels={gearboxModels || []} />
}
