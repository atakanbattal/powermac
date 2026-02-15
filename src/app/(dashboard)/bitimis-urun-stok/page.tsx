import { createClient } from '@/lib/supabase/server'
import { BitimisUrunStokClient } from './bitimis-urun-stok-client'

function getDateRange(searchParams: Promise<{ start?: string; end?: string }>) {
  return async () => {
    const params = await searchParams
    const now = new Date()
    if (params.start && params.end) {
      const s = new Date(params.start)
      const e = new Date(params.end)
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) return { start: params.start, end: params.end }
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    return { start, end }
  }
}

export default async function BitimisUrunStokPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>
}) {
  const supabase = await createClient()
  const { start, end } = await getDateRange(searchParams)()

  const [{ data: stockGearboxes }, { data: revizyonGearboxes }, { data: allGearboxes }] = await Promise.all([
    supabase.from('gearboxes').select('*, responsible_user:profiles(full_name)').eq('status', 'stokta').gte('production_date', start).lte('production_date', end).order('production_date', { ascending: false }),
    supabase.from('gearboxes').select('*, responsible_user:profiles(full_name)').eq('status', 'revizyon_iade').order('updated_at', { ascending: false }),
    supabase.from('gearboxes').select('model, status'),
  ])

  return (
    <BitimisUrunStokClient
      stockGearboxes={stockGearboxes || []}
      revizyonGearboxes={revizyonGearboxes || []}
      allGearboxes={allGearboxes || []}
      dateRangeStart={start}
      dateRangeEnd={end}
    />
  )
}
