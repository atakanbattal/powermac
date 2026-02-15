'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { MODEL_LABELS } from '@/lib/constants'
import type { ControlPlanRevision, ControlPlanItem } from '@/lib/types'
import { Plus, ClipboardList, Loader2, Trash2, Star, Pencil, Save, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

interface GearboxModelRow {
  id: string
  code: string
  name: string
  sort_order: number
}

interface Props {
  controlPlans: (ControlPlanRevision & { control_plan_items: ControlPlanItem[] })[]
  materials: { id: string; code: string; name: string }[]
  gearboxModels: GearboxModelRow[]
}

const CHARACTERISTIC_OPTIONS = ['Fonksiyonel', 'Kritik', 'Emniyet', 'Minör']
const MEASUREMENT_METHOD_OPTIONS = [
  'Görsel', 'Boyutsal', 'Fonksiyonel Test', 'Yüzey Pürüzlülüğü', 'Sertlik Testi', 'Moment Testi',
  'Koordinat Ölçüm (CMM)', 'Sızdırmazlık Testi', 'Gürültü / Sessizlik Testi', 'Kaplama Kontrolü',
  'Çizgisel Ölçüm', 'Açısal Ölçüm', 'Hidrolik Test', 'Manyetik Parçacık Testi (MPI)',
  'Penetrant Test', 'Ultrasonik Kontrol', 'Rulman Kontrolü', 'Diş Profil Kontrolü',
  'Eksenel / Radyal Boşluk Ölçümü', 'Yüzey Kalitesi Kontrolü',
]
const EQUIPMENT_OPTIONS = [
  'Kumpas', 'Mikrometre', 'Komparatör', 'Tork Anahtarı', 'Sertlik Ölçer', 'Pürüzlülük Ölçer',
  'Gözle Kontrol', 'Mastar', 'CMM', 'İç Çap Kumpası', 'Gönye', 'Delik Mastarı', 'Ring Mastar',
  'Plug Gauge', 'Snap Gauge', 'Yükseklik Mastarı', 'Tolerans Saati (Dial Indicator)',
  'Profil Projeksiyon', 'Endüstriyel Mikroskop', 'Basınç Ölçer', 'Sızdırmazlık Test Cihazı',
  'Dinamometrik Tork Anahtarı', 'Mastar Takımı', 'Lazer Ölçüm Cihazı',
]

interface DraftItem {
  _key: string
  name: string
  characteristic: string
  nominal_value: string
  lower_limit: string
  upper_limit: string
  unit: string
  measurement_method: string
  equipment: string
  is_critical: boolean
}

function createEmptyDraftItem(): DraftItem {
  return {
    _key: crypto.randomUUID(),
    name: '', characteristic: '', nominal_value: '', lower_limit: '', upper_limit: '',
    unit: 'mm', measurement_method: '', equipment: '',
    is_critical: false,
  }
}

export function KontrolPlaniClient({ controlPlans: initPlans, materials, gearboxModels }: Props) {
  const [plans, setPlans] = useState(initPlans)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [planTarget, setPlanTarget] = useState<string>(gearboxModels[0]?.code ?? 'A')
  const [planDesc, setPlanDesc] = useState('')
  const [draftItems, setDraftItems] = useState<DraftItem[]>([createEmptyDraftItem()])
  const router = useRouter()
  const supabase = createClient()

  const targetOptions = [
    ...gearboxModels.map(m => ({ value: m.code, label: m.name })),
    ...materials.map(m => ({ value: `mat:${m.id}`, label: `${m.code} - ${m.name}` })),
  ]

  const openCreateModal = () => {
    setEditingPlanId(null)
    setPlanTarget(gearboxModels[0]?.code ?? 'A')
    setPlanDesc('')
    setDraftItems([createEmptyDraftItem()])
    setCreateOpen(true)
  }

  const openEditPlan = (plan: (typeof plans)[0]) => {
    setEditingPlanId(plan.id)
    if (plan.target_type === 'model' && plan.model) {
      setPlanTarget(plan.model)
    } else if (plan.material_id) {
      setPlanTarget(`mat:${plan.material_id}`)
    }
    setPlanDesc(plan.description || '')
    const existingItems: DraftItem[] = (plan.control_plan_items || []).map(item => ({
      _key: item.id,
      name: item.name,
      characteristic: item.characteristic || '',
      nominal_value: item.nominal_value != null ? String(item.nominal_value) : '',
      lower_limit: item.lower_limit != null ? String(item.lower_limit) : '',
      upper_limit: item.upper_limit != null ? String(item.upper_limit) : '',
      unit: item.unit || 'mm',
      measurement_method: item.measurement_method || '',
      equipment: item.equipment || '',
      is_critical: item.is_critical,
    }))
    setDraftItems(existingItems.length > 0 ? existingItems : [createEmptyDraftItem()])
    setCreateOpen(true)
  }

  const addDraftRow = () => setDraftItems([...draftItems, createEmptyDraftItem()])
  const removeDraftRow = (key: string) => {
    if (draftItems.length <= 1) return
    setDraftItems(draftItems.filter(d => d._key !== key))
  }
  const updateDraftRow = (key: string, field: keyof DraftItem, value: string | boolean) => {
    setDraftItems(draftItems.map(d => d._key === key ? { ...d, [field]: value } : d))
  }

  const handleCreatePlanWithItems = async () => {
    const validItems = draftItems.filter(d => d.name.trim())
    if (validItems.length === 0) {
      toast.error('En az bir kontrol maddesi ekleyin')
      return
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const isModel = !planTarget.startsWith('mat:')
      const modelVal = isModel ? planTarget : null
      const materialId = planTarget.startsWith('mat:') ? planTarget.replace('mat:', '') : null
      const targetName = targetOptions.find(o => o.value === planTarget)?.label || planTarget

      let maxRev = 0
      if (isModel) {
        const { data: existingRevs } = await supabase
          .from('control_plan_revisions')
          .select('revision_no')
          .eq('model', planTarget)
          .order('revision_no', { ascending: false })
          .limit(1)
        maxRev = existingRevs?.[0]?.revision_no || 0
      } else if (materialId) {
        const { data: existingRevs } = await supabase
          .from('control_plan_revisions')
          .select('revision_no')
          .eq('material_id', materialId)
          .order('revision_no', { ascending: false })
          .limit(1)
        maxRev = existingRevs?.[0]?.revision_no || 0
      }

      if (isModel) {
        await supabase.from('control_plan_revisions').update({ is_active: false }).eq('model', planTarget).eq('is_active', true)
      } else if (materialId) {
        await supabase.from('control_plan_revisions').update({ is_active: false }).eq('material_id', materialId).eq('is_active', true)
      }

      const { data: plan, error: planErr } = await supabase.from('control_plan_revisions').insert({
        model: modelVal, revision_no: maxRev + 1, description: planDesc, is_active: true,
        created_by: user?.id, target_type: isModel ? 'model' : 'material',
        target_name: targetName, material_id: materialId,
      }).select().single()
      if (planErr) throw new Error(planErr.message || 'Plan oluşturma hatası')

      const itemsToInsert = validItems.map((item, idx) => ({
        control_plan_id: plan.id,
        name: item.name,
        characteristic: item.characteristic || null,
        nominal_value: item.nominal_value ? parseFloat(item.nominal_value) : null,
        lower_limit: item.lower_limit ? parseFloat(item.lower_limit) : null,
        upper_limit: item.upper_limit ? parseFloat(item.upper_limit) : null,
        unit: item.unit || 'mm',
        measurement_method: item.measurement_method || null,
        equipment: item.equipment || null,
        is_critical: item.is_critical,
        sort_order: idx + 1,
      }))

      const { data: insertedItems, error: itemsErr } = await supabase
        .from('control_plan_items').insert(itemsToInsert).select()
      if (itemsErr) throw new Error(itemsErr.message || 'Madde ekleme hatası')

      const newPlan = { ...plan, control_plan_items: insertedItems || [] }
      setPlans([newPlan, ...plans.filter(p => {
        if (isModel) return p.model !== planTarget
        return p.material_id !== materialId
      })])
      setCreateOpen(false)
      toast.success(`${targetName} kontrol planı oluşturuldu (${validItems.length} madde)`)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bilinmeyen hata')
    } finally { setLoading(false) }
  }

  const handleUpdatePlanItems = async () => {
    if (!editingPlanId) return
    const validItems = draftItems.filter(d => d.name.trim())
    if (validItems.length === 0) {
      toast.error('En az bir kontrol maddesi ekleyin')
      return
    }
    setLoading(true)
    try {
      await supabase.from('control_plan_revisions').update({ description: planDesc }).eq('id', editingPlanId)
      await supabase.from('control_plan_items').delete().eq('control_plan_id', editingPlanId)

      const itemsToInsert = validItems.map((item, idx) => ({
        control_plan_id: editingPlanId,
        name: item.name,
        characteristic: item.characteristic || null,
        nominal_value: item.nominal_value ? parseFloat(item.nominal_value) : null,
        lower_limit: item.lower_limit ? parseFloat(item.lower_limit) : null,
        upper_limit: item.upper_limit ? parseFloat(item.upper_limit) : null,
        unit: item.unit || 'mm',
        measurement_method: item.measurement_method || null,
        equipment: item.equipment || null,
        is_critical: item.is_critical,
        sort_order: idx + 1,
      }))

      const { data: insertedItems, error: itemsErr } = await supabase
        .from('control_plan_items').insert(itemsToInsert).select()
      if (itemsErr) throw new Error(itemsErr.message || 'Madde ekleme hatası')

      setPlans(plans.map(p => p.id === editingPlanId ? { ...p, description: planDesc, control_plan_items: insertedItems || [] } : p))
      setCreateOpen(false)
      setEditingPlanId(null)
      toast.success(`Kontrol planı güncellendi (${validItems.length} madde)`)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bilinmeyen hata')
    } finally { setLoading(false) }
  }

  const handleDeletePlan = async (planId: string, name: string) => {
    if (!confirm(`"${name}" kontrol planını silmek istediğinize emin misiniz?`)) return
    await supabase.from('control_plan_revisions').delete().eq('id', planId)
    setPlans(plans.filter(p => p.id !== planId))
    toast.success('Plan silindi')
    router.refresh()
  }

  const getPlanLabel = (plan: (typeof plans)[0]) => {
    return plan.target_name || (plan.model ? (MODEL_LABELS[plan.model] ?? plan.model) : 'Plan')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kontrol Planları</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ürün ve malzeme bazlı kalite kontrol planları. Final Kalite Kontrol ve Girdi Kontrol için kullanılır.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />Kontrol Planı Hazırla
          </Button>
        </div>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-2">Henüz kontrol planı yok</p>
            <p className="text-sm text-muted-foreground mb-4">Şanzıman modelleri veya malzemeler için kontrol planı oluşturun</p>
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />İlk Planı Oluştur
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {plans.map(plan => (
            <Card key={plan.id}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <ClipboardList className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold">{getPlanLabel(plan)}</CardTitle>
                      <p className="text-xs text-muted-foreground">{plan.description || `Rev. ${plan.revision_no}`} &bull; {plan.control_plan_items?.length ?? 0} madde</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEditPlan(plan)}>
                      <Pencil className="w-3 h-3 mr-1" />Düzenle
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => handleDeletePlan(plan.id, getPlanLabel(plan))}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" />Sil
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-10">Kritik</TableHead>
                        <TableHead>Kontrol Maddesi</TableHead>
                        <TableHead className="w-28">Karakteristik</TableHead>
                        <TableHead className="w-24">Nominal</TableHead>
                        <TableHead className="w-24">Min</TableHead>
                        <TableHead className="w-24">Max</TableHead>
                        <TableHead className="w-20">Birim</TableHead>
                        <TableHead>Ölçüm Yöntemi</TableHead>
                        <TableHead>Ekipman</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!plan.control_plan_items || plan.control_plan_items.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-4 text-muted-foreground text-sm">
                            Kontrol maddesi yok - &quot;Planı Düzenle&quot; ile madde ekleyin
                          </TableCell>
                        </TableRow>
                      ) : plan.control_plan_items.map(item => (
                        <TableRow key={item.id} className="text-sm">
                          <TableCell>{item.is_critical && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.characteristic || '-'}</TableCell>
                          <TableCell className="font-mono text-sm">{item.nominal_value ?? '-'}</TableCell>
                          <TableCell className="font-mono text-sm">{item.lower_limit ?? '-'}</TableCell>
                          <TableCell className="font-mono text-sm">{item.upper_limit ?? '-'}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.measurement_method || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.equipment || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Plan Oluştur / Düzenle - Tam Sayfa Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col">
          <div className="border-b px-6 py-4 flex items-center justify-between bg-white dark:bg-slate-950 shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={() => { setCreateOpen(false); setEditingPlanId(null) }} className="text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  {editingPlanId ? 'Kontrol Planını Düzenle' : 'Kontrol Planı Hazırla'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {editingPlanId ? 'Maddeleri ekleyin, düzenleyin veya silin' : 'Tüm kontrol maddelerini detaylı olarak tanımlayın'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                {draftItems.filter(d => d.name.trim()).length} / {draftItems.length} madde
              </p>
              <Button variant="outline" onClick={() => { setCreateOpen(false); setEditingPlanId(null) }}>İptal</Button>
              <Button
                onClick={editingPlanId ? handleUpdatePlanItems : handleCreatePlanWithItems}
                disabled={loading || draftItems.filter(d => d.name.trim()).length === 0}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {editingPlanId ? 'Güncelle' : 'Kaydet'} ({draftItems.filter(d => d.name.trim()).length} madde)
              </Button>
            </div>
          </div>

          <div className="px-6 py-4 border-b bg-muted/30 shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl">
              <div className="space-y-2">
                <Label className="font-semibold">Ürün / Model / Malzeme *</Label>
                <Select value={planTarget} onValueChange={setPlanTarget} disabled={!!editingPlanId}>
                  <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {targetOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="font-semibold">Açıklama (opsiyonel)</Label>
                <Input value={planDesc} onChange={e => setPlanDesc(e.target.value)} placeholder="Kontrol planı açıklaması" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="min-w-[1100px]">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/50 sticky top-0 z-10">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="min-w-[200px]">Kontrol Maddesi *</TableHead>
                    <TableHead className="min-w-[150px]">Karakteristik</TableHead>
                    <TableHead className="w-28">Nominal</TableHead>
                    <TableHead className="w-28">Min Tolerans</TableHead>
                    <TableHead className="w-28">Max Tolerans</TableHead>
                    <TableHead className="w-20">Birim</TableHead>
                    <TableHead className="min-w-[150px]">Ölçüm Yöntemi</TableHead>
                    <TableHead className="min-w-[150px]">Ekipman</TableHead>
                    <TableHead className="w-14 text-center">Kritik</TableHead>
                    <TableHead className="w-12">Sil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draftItems.map((item, idx) => (
                    <TableRow key={item._key} className="group">
                      <TableCell className="font-mono text-muted-foreground font-bold text-center">{idx + 1}</TableCell>
                      <TableCell>
                        <Input className="h-9 text-sm" value={item.name} onChange={e => updateDraftRow(item._key, 'name', e.target.value)} placeholder="Ör: Mil Çapı, Sertlik" />
                      </TableCell>
                      <TableCell>
                        <Select value={item.characteristic || '_empty'} onValueChange={v => updateDraftRow(item._key, 'characteristic', v === '_empty' ? '' : v)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_empty">Seçin...</SelectItem>
                            {CHARACTERISTIC_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input className="h-9 text-sm font-mono" type="number" step="0.001" value={item.nominal_value} onChange={e => updateDraftRow(item._key, 'nominal_value', e.target.value)} placeholder="25.00" />
                      </TableCell>
                      <TableCell>
                        <Input className="h-9 text-sm font-mono" type="number" step="0.001" value={item.lower_limit} onChange={e => updateDraftRow(item._key, 'lower_limit', e.target.value)} placeholder="Min" />
                      </TableCell>
                      <TableCell>
                        <Input className="h-9 text-sm font-mono" type="number" step="0.001" value={item.upper_limit} onChange={e => updateDraftRow(item._key, 'upper_limit', e.target.value)} placeholder="Max" />
                      </TableCell>
                      <TableCell>
                        <Input className="h-9 text-sm" value={item.unit} onChange={e => updateDraftRow(item._key, 'unit', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Select value={item.measurement_method || '_empty'} onValueChange={v => updateDraftRow(item._key, 'measurement_method', v === '_empty' ? '' : v)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_empty">Seçin...</SelectItem>
                            {MEASUREMENT_METHOD_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={item.equipment || '_empty'} onValueChange={v => updateDraftRow(item._key, 'equipment', v === '_empty' ? '' : v)}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seçin" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_empty">Seçin...</SelectItem>
                            {EQUIPMENT_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={item.is_critical} onCheckedChange={v => updateDraftRow(item._key, 'is_critical', v as boolean)} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeDraftRow(item._key)} disabled={draftItems.length <= 1}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="border-t px-6 py-3 flex items-center justify-between bg-white dark:bg-slate-950 shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={addDraftRow}>
                <Plus className="w-4 h-4 mr-1" />Yeni Satır Ekle
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDraftItems(prev => [...prev, ...Array.from({ length: 5 }, () => createEmptyDraftItem())])}>
                <Plus className="w-4 h-4 mr-1" />5 Satır Ekle
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{draftItems.filter(d => d.name.trim()).length} madde dolduruldu</span>
              <Button onClick={editingPlanId ? handleUpdatePlanItems : handleCreatePlanWithItems} disabled={loading || draftItems.filter(d => d.name.trim()).length === 0} size="lg">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {editingPlanId ? 'Planı Güncelle' : 'Planı Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
