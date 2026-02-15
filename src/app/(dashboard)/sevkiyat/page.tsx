import { createClient } from '@/lib/supabase/server'
import { SevkiyatClient } from './sevkiyat-client'

export default async function SevkiyatPage() {
  const supabase = await createClient()

  const { data: shipments } = await supabase
    .from('shipments')
    .select('*, gearbox:gearboxes(serial_number, model, status)')
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: stockGearboxes } = await supabase
    .from('gearboxes')
    .select('id, serial_number, model')
    .eq('status', 'stokta')
    .order('serial_number')

  const { data: shippedGearboxes } = await supabase
    .from('gearboxes')
    .select('id, serial_number, model')
    .eq('status', 'sevk_edildi')
    .order('serial_number')

  return (
    <SevkiyatClient
      shipments={shipments || []}
      stockGearboxes={stockGearboxes || []}
      shippedGearboxes={shippedGearboxes || []}
    />
  )
}
