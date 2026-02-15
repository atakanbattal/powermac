import { createClient } from '@/lib/supabase/server'
import { MalzemeClient } from './malzeme-client'

export default async function MalzemePage() {
  const supabase = await createClient()

  const { data: materials } = await supabase
    .from('materials')
    .select('*, default_supplier:suppliers(name)')
    .order('name')

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .eq('is_active', true)
    .order('name')

  const { data: stockEntries } = await supabase
    .from('material_stock_entries')
    .select('*, material:materials(code, name, unit), supplier:suppliers(name)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <MalzemeClient
      materials={materials || []}
      suppliers={suppliers || []}
      stockEntries={stockEntries || []}
    />
  )
}
