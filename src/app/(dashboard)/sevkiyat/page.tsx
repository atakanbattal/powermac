import { createClient } from '@/lib/supabase/server'
import { SevkiyatClient } from './sevkiyat-client'

async function getDateRange(searchParams: Promise<{ start?: string; end?: string }>) {
    const params = await searchParams
    const now = new Date()
    let start: string
    let end: string
    if (params.start && params.end) {
      const s = new Date(params.start)
      const e = new Date(params.end)
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        start = params.start
        end = params.end
        return { start, end }
      }
    }
  start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  return { start, end }
}

export default async function SevkiyatPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>
}) {
  const supabase = await createClient()
  const { start, end } = await getDateRange(searchParams)

  const [{ data: shipments }, { data: stockGearboxes }] = await Promise.all([
    supabase.from('shipments').select('*, gearbox:gearboxes(serial_number, model, status)').gte('shipment_date', start).lte('shipment_date', end).order('created_at', { ascending: false }).limit(100),
    supabase.from('gearboxes').select('id, serial_number, model').eq('status', 'stokta').order('serial_number'),
  ])

  return (
    <SevkiyatClient
      shipments={shipments || []}
      stockGearboxes={stockGearboxes || []}
      dateRangeStart={start}
      dateRangeEnd={end}
    />
  )
}
