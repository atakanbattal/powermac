import { createClient } from '@/lib/supabase/server'
import { UretimClient } from './uretim-client'

export default async function UretimPage() {
  const supabase = await createClient()

  const { data: gearboxes } = await supabase
    .from('gearboxes')
    .select('*, responsible_user:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  return <UretimClient gearboxes={gearboxes || []} />
}
