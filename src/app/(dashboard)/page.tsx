import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'
import type { GearboxModel } from '@/lib/types'

async function parseDateRange(searchParams: Promise<{ start?: string; end?: string }>) {
  const params = await searchParams
  const startStr = params.start
  const endStr = params.end
  const now = new Date()
  let startDate: Date
  let endDate: Date
  if (startStr && endStr) {
    const s = new Date(startStr)
    const e = new Date(endStr)
    if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e) {
      startDate = s
      endDate = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59)
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    }
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  }
  return { startDate, endDate }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>
}) {
  const supabase = await createClient()
  const { startDate, endDate } = await parseDateRange(searchParams)

  const startOfMonth = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).toISOString()
  const endOfMonth = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59).toISOString()

  // Aylık trend için 6 ay aralıkları (bitiş tarihinden geriye)
  const monthRanges = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(endDate.getFullYear(), endDate.getMonth() - (5 - i), 1)
    return {
      start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      label: d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
    }
  })

  // Tüm bağımsız sorguları paralel çalıştır
  const [
    { data: monthlyProdRaw },
    { data: monthlyShipRaw },
    { data: stockRaw },
    { data: allGearboxes },
    { data: allMaterials },
    { data: recentAudit },
    ...bomResults
  ] = await Promise.all([
    supabase.from('gearboxes').select('model, id').gte('production_date', startOfMonth).lte('production_date', endOfMonth),
    supabase.from('shipments').select('id, gearbox:gearboxes(model)').gte('shipment_date', startOfMonth).lte('shipment_date', endOfMonth),
    supabase.from('gearboxes').select('model, id').eq('status', 'stokta'),
    supabase.from('gearboxes').select('status'),
    supabase.from('materials').select('*').eq('is_active', true).order('name'),
    supabase.from('audit_logs').select('*, user:profiles(full_name)').order('created_at', { ascending: false }).limit(8),
    ...(['A', 'B', 'C'] as const).map(model =>
      supabase.from('bom_revisions').select('id, revision_no, bom_items(*, material:materials!material_id(*))').eq('model', model).eq('is_active', true).order('revision_no', { ascending: false }).limit(1)
    ),
  ])

  // Aylık trend (6 ay paralel)
  const monthlyTrendData = await Promise.all(
    monthRanges.map(({ start, end }) =>
      supabase.from('gearboxes').select('model').gte('production_date', start).lte('production_date', end)
    )
  )

  // NCR, sevkiyat, üretim, revizyon paralel
  const [
    { data: ncrRaw },
    { data: allShipmentsRaw },
    { data: allProdRaw },
    { data: revizyonRaw },
  ] = await Promise.all([
    supabase.from('ncr_records').select('id, status, gearbox:gearboxes(model)'),
    supabase.from('shipments').select('id, gearbox:gearboxes(model)'),
    supabase.from('gearboxes').select('model'),
    supabase.from('gearboxes').select('model').eq('status', 'revizyon_iade'),
  ])

  // Prod/ship/stock counts
  const prodCounts: Record<string, number> = { A: 0, B: 0, C: 0 }
  monthlyProdRaw?.forEach((g) => { prodCounts[g.model] = (prodCounts[g.model] || 0) + 1 })

  const shipCounts: Record<string, number> = { A: 0, B: 0, C: 0 }
  monthlyShipRaw?.forEach((s) => {
    const model = (s.gearbox as unknown as { model: string })?.model
    if (model) shipCounts[model] = (shipCounts[model] || 0) + 1
  })

  const stockCounts: Record<string, number> = { A: 0, B: 0, C: 0 }
  stockRaw?.forEach((g) => { stockCounts[g.model] = (stockCounts[g.model] || 0) + 1 })

  const statusDist: Record<string, number> = {}
  allGearboxes?.forEach((g) => { statusDist[g.status] = (statusDist[g.status] || 0) + 1 })

  const criticalMats = (allMaterials || []).filter(m => m.current_stock < m.min_stock)

  // BOM kapasitesi
  const capacityByModel: {
    model: GearboxModel
    maxGearboxes: number
    bottleneck: string | null
    items: { materialName: string; materialCode: string; currentStock: number; requiredPerUnit: number; possibleUnits: number; unit: string; isCritical: boolean }[]
  }[] = []

  const models: GearboxModel[] = ['A', 'B', 'C']
  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    const res = bomResults[i] as { data: { bom_items?: { material: unknown; quantity_per_unit: number }[] }[] | null }
    const bomRevision = res?.data?.[0] ?? null

    if (!bomRevision || !bomRevision.bom_items || bomRevision.bom_items.length === 0) {
      capacityByModel.push({ model, maxGearboxes: 0, bottleneck: 'BOM tanımlı değil', items: [] })
      continue
    }

    let minPossible = Infinity
    let bottleneckName: string | null = null
    const items: typeof capacityByModel[0]['items'] = []

    for (const item of bomRevision.bom_items) {
      const mat = item.material as { name: string; code: string; current_stock: number; unit: string; is_critical: boolean } | null
      if (!mat) continue

      const possibleUnits = item.quantity_per_unit > 0 ? Math.floor(mat.current_stock / item.quantity_per_unit) : Infinity

      items.push({
        materialName: mat.name,
        materialCode: mat.code,
        currentStock: mat.current_stock,
        requiredPerUnit: item.quantity_per_unit,
        possibleUnits,
        unit: mat.unit,
        isCritical: (item as { is_critical?: boolean }).is_critical ?? false,
      })

      if (possibleUnits < minPossible) {
        minPossible = possibleUnits
        bottleneckName = mat.name
      }
    }

    capacityByModel.push({
      model,
      maxGearboxes: minPossible === Infinity ? 0 : minPossible,
      bottleneck: bottleneckName,
      items: items.sort((a, b) => a.possibleUnits - b.possibleUnits),
    })
  }

  const monthlyTrend = monthRanges.map((r, i) => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0 }
    const res = monthlyTrendData[i] as { data?: { model: string }[] }
    res.data?.forEach((g) => {
      if (g.model) counts[g.model] = (counts[g.model] || 0) + 1
    })
    return { month: r.label, A: counts.A ?? 0, B: counts.B ?? 0, C: counts.C ?? 0 }
  })

  const ncrByModel: Record<string, { total: number; open: number }> = { A: { total: 0, open: 0 }, B: { total: 0, open: 0 }, C: { total: 0, open: 0 } }
  ncrRaw?.forEach((ncr) => {
    const model = (ncr.gearbox as unknown as { model: string })?.model
    if (model && ncrByModel[model]) {
      ncrByModel[model].total++
      if (ncr.status !== 'kapandi') ncrByModel[model].open++
    }
  })

  const totalShipByModel: Record<string, number> = { A: 0, B: 0, C: 0 }
  allShipmentsRaw?.forEach((s) => {
    const model = (s.gearbox as unknown as { model: string })?.model
    if (model) totalShipByModel[model] = (totalShipByModel[model] || 0) + 1
  })

  const totalProdByModel: Record<string, number> = { A: 0, B: 0, C: 0 }
  allProdRaw?.forEach((g) => { totalProdByModel[g.model] = (totalProdByModel[g.model] || 0) + 1 })

  const revizyonByModel: Record<string, number> = { A: 0, B: 0, C: 0 }
  revizyonRaw?.forEach((g) => { revizyonByModel[g.model] = (revizyonByModel[g.model] || 0) + 1 })

  const dateStartStr = startDate.toISOString().split('T')[0]
  const dateEndStr = endDate.toISOString().split('T')[0]

  return (
    <DashboardClient
      prodCounts={prodCounts}
      stockCounts={stockCounts}
      shipCounts={shipCounts}
      statusDist={statusDist}
      criticalMaterials={criticalMats}
      recentAudit={recentAudit || []}
      capacityByModel={capacityByModel}
      monthlyTrend={monthlyTrend}
      ncrByModel={ncrByModel}
      totalShipByModel={totalShipByModel}
      totalProdByModel={totalProdByModel}
      revizyonByModel={revizyonByModel}
      allMaterials={allMaterials || []}
      dateRangeStart={dateStartStr}
      dateRangeEnd={dateEndStr}
    />
  )
}
