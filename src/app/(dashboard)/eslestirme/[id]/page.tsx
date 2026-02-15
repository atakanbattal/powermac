import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { EslestirmeClient } from './eslestirme-client'

export default async function EslestirmePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: gearbox } = await supabase
    .from('gearboxes')
    .select('*, bom_revision:bom_revisions(id, model, revision_no, bom_items(*, material:materials(id, code, name, unit, current_stock)))')
    .eq('id', id)
    .single()

  if (!gearbox) notFound()

  const { data: existingMappings } = await supabase
    .from('gearbox_part_mappings')
    .select('*, material:materials(code, name, unit), stock_entry:material_stock_entries(id, invoice_number, lot_number, remaining_quantity, supplier:suppliers(name))')
    .eq('gearbox_id', id)

  // Stok girişleri (kalan > 0)
  const { data: stockEntries } = await supabase
    .from('material_stock_entries')
    .select('*, material:materials(code, name, unit), supplier:suppliers(name)')
    .gt('remaining_quantity', 0)
    .order('entry_date', { ascending: false })

  return (
    <EslestirmeClient
      gearbox={gearbox}
      existingMappings={existingMappings || []}
      stockEntries={stockEntries || []}
    />
  )
}
