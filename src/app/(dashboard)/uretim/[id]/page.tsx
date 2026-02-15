import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { GearboxDetailClient } from './detail-client'

export default async function GearboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: gearbox } = await supabase
    .from('gearboxes')
    .select(`
      *,
      responsible_user:profiles(full_name, role),
      bom_revision:bom_revisions(id, model, revision_no)
    `)
    .eq('id', id)
    .single()

  if (!gearbox) notFound()

  // Parça eşleştirmeleri
  const { data: partMappings } = await supabase
    .from('gearbox_part_mappings')
    .select(`
      *,
      material:materials(code, name, unit, category),
      stock_entry:material_stock_entries(invoice_number, lot_number, supplier:suppliers(name))
    `)
    .eq('gearbox_id', id)

  // Kalite kontrol
  const { data: inspections } = await supabase
    .from('quality_inspections')
    .select(`
      *,
      inspector:profiles(full_name),
      control_plan:control_plan_revisions(model, revision_no),
      quality_measurements(
        *,
        control_plan_item:control_plan_items(name, characteristic, nominal_value, lower_limit, upper_limit, unit, is_critical)
      )
    `)
    .eq('gearbox_id', id)
    .order('created_at', { ascending: false })

  // Sevkiyat
  const { data: shipments } = await supabase
    .from('shipments')
    .select('*')
    .eq('gearbox_id', id)

  // Montaj
  const { data: assemblies } = await supabase
    .from('vehicle_assemblies')
    .select('*')
    .eq('gearbox_id', id)

  // NCR
  const { data: ncrs } = await supabase
    .from('ncr_records')
    .select('*, responsible_user:profiles(full_name)')
    .eq('gearbox_id', id)

  // Ekler
  const { data: attachments } = await supabase
    .from('attachments')
    .select('*')
    .eq('entity_type', 'gearboxes')
    .eq('entity_id', id)

  // Audit trail
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*, user:profiles(full_name)')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(30)

  return (
    <GearboxDetailClient
      gearbox={gearbox}
      partMappings={partMappings || []}
      inspections={inspections || []}
      shipments={shipments || []}
      assemblies={assemblies || []}
      ncrs={ncrs || []}
      attachments={attachments || []}
      auditLogs={auditLogs || []}
    />
  )
}
