import { createClient } from '@/lib/supabase/server'
import { KontrolPlaniClient } from './kontrol-plani-client'

export default async function KontrolPlaniPage() {
  const supabase = await createClient()
  const { data: plans } = await supabase
    .from('control_plan_revisions')
    .select('*, control_plan_items(*)')
    .order('model')
    .order('revision_no', { ascending: false })

  return <KontrolPlaniClient plans={plans || []} />
}
