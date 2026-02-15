import { createClient } from '@/lib/supabase/server'
import { KaliteKontrolClient } from './kalite-kontrol-client'

export default async function KaliteKontrolPage() {
  const supabase = await createClient()

  const [
    { data: inspections },
    { data: pendingGearboxes },
    { data: controlPlans },
    { data: materials },
  ] = await Promise.all([
    supabase
      .from('quality_inspections')
      .select(`
        *,
        gearbox:gearboxes(serial_number, model, status, parts_mapping_complete),
        inspector:profiles(full_name),
        control_plan:control_plan_revisions(model, revision_no, target_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('gearboxes')
      .select('id, serial_number, model, parts_mapping_complete')
      .eq('status', 'final_kontrol_bekliyor')
      .order('created_at', { ascending: false }),
    supabase
      .from('control_plan_revisions')
      .select('*, control_plan_items(*)')
      .eq('is_active', true)
      .order('model'),
    supabase
      .from('materials')
      .select('id, code, name')
      .eq('is_active', true)
      .order('code'),
  ])

  return (
    <KaliteKontrolClient
      inspections={inspections || []}
      pendingGearboxes={pendingGearboxes || []}
      controlPlans={controlPlans || []}
      materials={materials || []}
    />
  )
}
