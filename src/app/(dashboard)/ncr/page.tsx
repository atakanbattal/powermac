import { createClient } from '@/lib/supabase/server'
import { NcrClient } from './ncr-client'

export default async function NcrPage() {
  const supabase = await createClient()
  const { data: ncrs } = await supabase
    .from('ncr_records')
    .select('*, gearbox:gearboxes(serial_number, model), responsible_user:profiles(full_name)')
    .order('created_at', { ascending: false })

  return <NcrClient ncrs={ncrs || []} />
}
