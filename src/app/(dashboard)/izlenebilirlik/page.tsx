import { createClient } from '@/lib/supabase/server'
import { IzlenebilirlikClient } from './izlenebilirlik-client'

export default async function IzlenebilirlikPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const supabase = await createClient()

  let results: { type: string; [key: string]: unknown }[] = []

  if (q) {
    // Seri no, VIN, plaka, irsaliye ile ara
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

    const { data: byInvoice } = await supabase
      .from('shipments')
      .select('gearbox_id, waybill_number, invoice_number, gearbox:gearboxes(id, serial_number, model, status)')
      .or(`waybill_number.ilike.%${q}%,invoice_number.ilike.%${q}%`)
      .limit(20)

    // Lot bazlı arama
    const { data: byLot } = await supabase
      .from('material_stock_entries')
      .select('id, lot_number, invoice_number, material:materials(code, name)')
      .or(`lot_number.ilike.%${q}%,invoice_number.ilike.%${q}%`)
      .limit(20)

    results = [
      ...(bySerial || []).map(g => ({ type: 'gearbox', ...g })),
      ...(byVin || []).map(v => ({ type: 'vehicle', ...v, ...((v.gearbox && typeof v.gearbox === 'object') ? v.gearbox : {}) })),
      ...(byInvoice || []).map(s => ({ type: 'shipment', ...s, ...((s.gearbox && typeof s.gearbox === 'object') ? s.gearbox : {}) })),
      ...(byLot || []).map(l => ({ type: 'lot', ...l })),
    ]
  }

  return <IzlenebilirlikClient query={q || ''} results={results} />
}
