import { createClient } from '@/lib/supabase/server'
import { KaliteKontrolClient } from './kalite-kontrol-client'

export default async function KaliteKontrolPage() {
  const supabase = await createClient()

  const { data: inspections } = await supabase
    .from('quality_inspections')
    .select(`
      *,
      gearbox:gearboxes(serial_number, model, status, parts_mapping_complete),
      inspector:profiles(full_name),
      control_plan:control_plan_revisions(model, revision_no)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: pendingGearboxes } = await supabase
    .from('gearboxes')
    .select('id, serial_number, model, parts_mapping_complete')
    .eq('status', 'final_kontrol_bekliyor')
    .order('created_at', { ascending: false })

  return (
    <KaliteKontrolClient
      inspections={inspections || []}
      pendingGearboxes={pendingGearboxes || []}
    />
  )
}
