import { createClient } from '@/lib/supabase/server'
import { GirdiKontrolClient } from './girdi-kontrol-client'

async function getDateRange(searchParams: Promise<{ start?: string; end?: string }>) {
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

export default async function GirdiKontrolPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>
}) {
  const supabase = await createClient()
  const { start, end } = await getDateRange(searchParams)

  const [
    { data: materialPlans },
    { data: recentReceipts },
    { data: recentEntries },
    { data: inspections },
    { data: materials },
    { data: quarantineItems },
  ] = await Promise.all([
    // Malzeme bazlı kontrol planları
    supabase
      .from('control_plan_revisions')
      .select('*, control_plan_items(*)')
      .eq('target_type', 'material')
      .eq('is_active', true)
      .order('target_name'),
    // Tesellüm bekleyenler (kontrol edilecek)
    supabase
      .from('material_receipts')
      .select('*, material:materials(id, code, name, unit), supplier:suppliers(name)')
      .in('status', ['teslim_alindi', 'kontrol_bekliyor'])
      .order('created_at', { ascending: false })
      .limit(50),
    // Son stok girişleri (referans)
    supabase
      .from('material_stock_entries')
      .select('*, material:materials(id, code, name, unit), supplier:suppliers(name)')
      .order('created_at', { ascending: false })
      .limit(20),
    // Mevcut girdi kontrol kayıtları
    supabase
      .from('material_inspections')
      .select(`
        *,
        material:materials(code, name, unit),
        inspector:profiles(full_name),
        control_plan:control_plan_revisions(target_name),
        material_measurements(id, measured_value, result, control_plan_item:control_plan_items(name, nominal_value, lower_limit, upper_limit, unit, is_critical))
      `)
      .gte('inspection_date', start)
      .lte('inspection_date', end)
      .order('created_at', { ascending: false })
      .limit(100),
    // Tüm aktif malzemeler
    supabase
      .from('materials')
      .select('id, code, name, unit')
      .eq('is_active', true)
      .order('code'),
    // Karantinadaki malzemeler + işlem geçmişi
    supabase
      .from('material_quarantine')
      .select(`
        *,
        material:materials(code, name, unit),
        quarantine_actions:material_quarantine_actions(decision, notes, decided_at)
      `)
      .eq('status', 'karantinada')
      .order('quarantined_at', { ascending: false })
      .limit(100),
  ])

  return (
    <GirdiKontrolClient
      materialPlans={materialPlans || []}
      recentReceipts={recentReceipts || []}
      recentEntries={recentEntries || []}
      inspections={inspections || []}
      materials={materials || []}
      quarantineItems={quarantineItems || []}
      dateRangeStart={start}
      dateRangeEnd={end}
    />
  )
}
