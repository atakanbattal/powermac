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

  const [
    { data: partMappings },
    { data: inspections },
    { data: shipments },
    { data: assemblies },
    { data: ncrs },
    { data: attachments },
    { data: auditLogs },
  ] = await Promise.all([
    supabase.from('gearbox_part_mappings').select('*, material:materials(code, name, unit, category), stock_entry:material_stock_entries(invoice_number, lot_number, quarantine_id, supplier:suppliers(name))').eq('gearbox_id', id),
    supabase.from('quality_inspections').select('*, inspector:profiles(full_name), control_plan:control_plan_revisions(model, revision_no), quality_measurements(*, control_plan_item:control_plan_items(name, characteristic, nominal_value, lower_limit, upper_limit, unit, is_critical))').eq('gearbox_id', id).order('created_at', { ascending: false }),
    supabase.from('shipments').select('*').eq('gearbox_id', id),
    supabase.from('vehicle_assemblies').select('*').eq('gearbox_id', id),
    supabase.from('ncr_records').select('*, responsible_user:profiles(full_name)').eq('gearbox_id', id),
    supabase.from('attachments').select('*').eq('entity_type', 'gearboxes').eq('entity_id', id),
    supabase.from('audit_logs').select('*, user:profiles(full_name)').eq('entity_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  // Karantina bilgilerini ayrıca çek (quarantine_id olan parçalar için)
  const quarantineIds = (partMappings || [])
    .map(pm => (pm as { stock_entry?: { quarantine_id?: string | null } }).stock_entry?.quarantine_id)
    .filter((qid): qid is string => !!qid)

  let quarantineMap: Record<string, { id: string; reason: string; status: string; quarantined_at: string; notes?: string | null }> = {}
  if (quarantineIds.length > 0) {
    const { data: quarantineData } = await supabase
      .from('material_quarantine')
      .select('id, reason, status, quarantined_at, notes')
      .in('id', quarantineIds)
    if (quarantineData) {
      quarantineMap = Object.fromEntries(quarantineData.map(q => [q.id, q]))
    }
  }

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
      quarantineMap={quarantineMap}
    />
  )
}
