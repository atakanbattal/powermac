import { createClient } from '@/lib/supabase/server'
import { KontrolPlaniClient } from './kontrol-plani-client'

export default async function KontrolPlaniPage() {
  const supabase = await createClient()

  const [{ data: controlPlans }, { data: materials }, { data: gearboxModels }] = await Promise.all([
    supabase
      .from('control_plan_revisions')
      .select('*, control_plan_items(*)')
      .eq('is_active', true)
      .order('model')
      .order('target_name'),
    supabase
      .from('materials')
      .select('id, code, name')
      .eq('is_active', true)
      .order('code'),
    supabase
      .from('gearbox_models')
      .select('id, code, name, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  return (
    <KontrolPlaniClient
      controlPlans={controlPlans || []}
      materials={materials || []}
      gearboxModels={gearboxModels || []}
    />
  )
}
