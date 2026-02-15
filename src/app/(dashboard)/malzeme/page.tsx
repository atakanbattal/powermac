import { createClient } from '@/lib/supabase/server'
import { MalzemeClient } from './malzeme-client'
import type { GearboxModel } from '@/lib/types'

export default async function MalzemePage() {
  const supabase = await createClient()

  const [
    { data: materials },
    { data: suppliers },
    { data: stockEntries },
    ...bomResults
  ] = await Promise.all([
    supabase.from('materials').select('*, default_supplier:suppliers(name)').eq('is_active', true).order('name'),
    supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
    supabase.from('material_stock_entries').select('*, material:materials(code, name, unit), supplier:suppliers(name)').order('created_at', { ascending: false }).limit(100),
    ...(['A', 'B', 'C'] as const).map(model =>
      supabase.from('bom_revisions').select('id, revision_no, bom_items(*, material:materials!material_id(*))').eq('model', model).eq('is_active', true).order('revision_no', { ascending: false }).limit(1)
    ),
  ])

  const models: GearboxModel[] = ['A', 'B', 'C']
  const capacityByModel: {
    model: GearboxModel
    maxGearboxes: number
    bottleneck: string | null
    bomDefined: boolean
    items: { materialId: string; materialName: string; materialCode: string; currentStock: number; requiredPerUnit: number; possibleUnits: number; unit: string; isCritical: boolean }[]
  }[] = []

  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    const res = bomResults[i] as { data: { bom_items?: { material: unknown; quantity_per_unit: number; is_critical?: boolean }[] }[] | null }
    const bomRevision = res?.data?.[0] ?? null

    if (!bomRevision || !bomRevision.bom_items || bomRevision.bom_items.length === 0) {
      capacityByModel.push({ model, maxGearboxes: 0, bottleneck: null, bomDefined: false, items: [] })
      continue
    }

    let minPossible = Infinity
    let bottleneckName: string | null = null
    const items: typeof capacityByModel[0]['items'] = []

    for (const item of bomRevision.bom_items) {
      const mat = item.material as { id: string; name: string; code: string; current_stock: number; unit: string; is_critical: boolean } | null
      if (!mat) continue

      const possibleUnits = item.quantity_per_unit > 0 ? Math.floor(mat.current_stock / item.quantity_per_unit) : Infinity

      items.push({
        materialId: mat.id,
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
      bomDefined: true,
      items: items.sort((a, b) => a.possibleUnits - b.possibleUnits),
    })
  }

  return (
    <MalzemeClient
      materials={materials || []}
      suppliers={suppliers || []}
      stockEntries={stockEntries || []}
      capacityByModel={capacityByModel}
    />
  )
}
