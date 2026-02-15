import { createClient } from '@/lib/supabase/server'
import { BomClient } from './bom-client'

export default async function BomPage() {
  const supabase = await createClient()

  const { data: bomRevisions } = await supabase
    .from('bom_revisions')
    .select('*, bom_items(*, material:materials(code, name, unit))')
    .order('model')
    .order('revision_no', { ascending: false })

  const { data: materials } = await supabase
    .from('materials')
    .select('id, code, name, unit')
    .eq('is_active', true)
    .order('code')

  return <BomClient bomRevisions={bomRevisions || []} materials={materials || []} />
}
