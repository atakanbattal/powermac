import { createClient } from '@/lib/supabase/server'
import { GirdiKontrolClient } from './girdi-kontrol-client'

export default async function GirdiKontrolPage() {
  const supabase = await createClient()

  const [
    { data: materialPlans },
    { data: recentEntries },
    { data: inspections },
    { data: materials },
  ] = await Promise.all([
    // Malzeme bazlı kontrol planları
    supabase
      .from('control_plan_revisions')
      .select('*, control_plan_items(*)')
      .eq('target_type', 'material')
      .eq('is_active', true)
      .order('target_name'),
    // Son stok girişleri (kontrol edilebilecek)
    supabase
      .from('material_stock_entries')
      .select('*, material:materials(id, code, name, unit), supplier:suppliers(name)')
      .order('created_at', { ascending: false })
      .limit(50),
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
      .order('created_at', { ascending: false })
      .limit(100),
    // Tüm aktif malzemeler
    supabase
      .from('materials')
      .select('id, code, name, unit')
      .eq('is_active', true)
      .order('code'),
  ])

  return (
    <GirdiKontrolClient
      materialPlans={materialPlans || []}
      recentEntries={recentEntries || []}
      inspections={inspections || []}
      materials={materials || []}
    />
  )
}
