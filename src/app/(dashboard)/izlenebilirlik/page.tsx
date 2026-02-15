import { createClient } from '@/lib/supabase/server'
import { IzlenebilirlikClient } from './izlenebilirlik-client'

export default async function IzlenebilirlikPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  const { q, id } = await searchParams
  const supabase = await createClient()

  // Tüm şanzımanları listele (sevk tarihi + montaj bilgisi dahil)
  const { data: gearboxes } = await supabase
    .from('gearboxes')
    .select('id, serial_number, model, status, production_date, production_start, production_end, shipments(shipment_date), vehicle_assemblies(vehicle_plate, vin_number)')
    .order('created_at', { ascending: false })
    .limit(200)

  // Arama sonuçları
  let searchResults: { type: string; [key: string]: unknown }[] = []
  if (q) {
    const { data: bySerial } = await supabase
      .from('gearboxes')
      .select('id, serial_number, model, status, production_date')
      .ilike('serial_number', `%${q}%`)
      .limit(20)

    const { data: byVin } = await supabase
      .from('vehicle_assemblies')
      .select('gearbox_id, vin_number, vehicle_plate, gearbox:gearboxes(id, serial_number, model, status)')
      .or(`vin_number.ilike.%${q}%,vehicle_plate.ilike.%${q}%`)
      .limit(20)

    searchResults = [
      ...(bySerial || []).map(g => ({ type: 'gearbox', ...g })),
      ...(byVin || []).map(v => ({ type: 'vehicle', ...v, ...((v.gearbox && typeof v.gearbox === 'object') ? v.gearbox : {}) })),
    ]
  }

  // Detay görünümü
  let detail = null
  let quarantineMap: Record<string, { id: string; reason: string; status: string; quarantined_at: string }> = {}
  if (id) {
    const { data: gearbox } = await supabase
      .from('gearboxes')
      .select(`
        *,
        responsible_user:profiles(full_name),
        gearbox_part_mappings(
          id, quantity, mapped_at,
          material:materials!material_id(code, name, unit),
          stock_entry:material_stock_entries(invoice_number, lot_number, quarantine_id, supplier:suppliers(name))
        ),
        quality_inspections(
          id, overall_result, inspection_date, is_draft, comments,
          inspector:profiles(full_name),
          quality_measurements(
            id, measured_value, result,
            control_plan_item:control_plan_items(name, nominal_value, lower_limit, upper_limit, unit, is_critical)
          )
        ),
        shipments(id, shipment_date, customer_name, waybill_number, invoice_number),
        vehicle_assemblies(id, assembly_date, vehicle_plate, vin_number, customer_name)
      `)
      .eq('id', id)
      .single()

    if (gearbox) {
      detail = gearbox

      // Karantina bilgilerini ayrıca çek
      const mappings = (gearbox as { gearbox_part_mappings?: { stock_entry?: { quarantine_id?: string | null } | null }[] }).gearbox_part_mappings || []
      const quarantineIds = mappings
        .map(m => m.stock_entry?.quarantine_id)
        .filter((qid): qid is string => !!qid)

      if (quarantineIds.length > 0) {
        const { data: quarantineData } = await supabase
          .from('material_quarantine')
          .select('id, reason, status, quarantined_at')
          .in('id', quarantineIds)
        if (quarantineData) {
          quarantineMap = Object.fromEntries(quarantineData.map(q => [q.id, q]))
        }
      }
    }
  }

  return (
    <IzlenebilirlikClient
      gearboxes={gearboxes || []}
      query={q || ''}
      searchResults={searchResults}
      detail={detail}
      quarantineMap={quarantineMap}
    />
  )
}
