import { createClient } from '@/lib/supabase/server'
import { BomClient } from './bom-client'

export default async function BomPage() {
  const supabase = await createClient()

  const [{ data: bomRevisions }, { data: materials }, { data: gearboxModels }] = await Promise.all([
    supabase.from('bom_revisions').select('*, bom_items(*, material:materials!material_id(code, name, unit))').order('model').order('revision_no', { ascending: false }),
    supabase.from('materials').select('id, code, name, unit').eq('is_active', true).order('code'),
    supabase.from('gearbox_models').select('id, code, name, sort_order').eq('is_active', true).order('sort_order'),
  ])

  return <BomClient bomRevisions={bomRevisions || []} materials={materials || []} gearboxModels={gearboxModels || []} />
}
