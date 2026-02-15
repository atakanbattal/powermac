import { createClient } from '@/lib/supabase/server'
import { KaliteKontrolClient } from './kalite-kontrol-client'

function getDateRange(searchParams: Promise<{ start?: string; end?: string }>) {
  return async () => {
    const params = await searchParams
    const now = new Date()
    if (params.start && params.end) {
      const s = new Date(params.start)
      const e = new Date(params.end)
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) return { start: params.start, end: params.end }
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    return { start, end }
  }
}

export default async function KaliteKontrolPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>
}) {
  const supabase = await createClient()
  const { start, end } = await getDateRange(searchParams)()

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
      .gte('inspection_date', start)
      .lte('inspection_date', end)
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
      dateRangeStart={start}
      dateRangeEnd={end}
    />
  )
}
