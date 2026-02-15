'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { MODEL_LABELS } from '@/lib/constants'
import type { ControlPlanRevision, ControlPlanItem, InspectionResult, GearboxModel } from '@/lib/types'
import {
  Plus, ShieldCheck, Eye, AlertTriangle, CheckCircle, XCircle, Clock,
  ClipboardList, Loader2, Trash2, Star, Pencil, Send, Save, ArrowLeft, X, Check
} from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  inspections: {
    id: string; overall_result: string; inspection_date: string; is_draft: boolean; comments?: string
    gearbox?: { serial_number: string; model: string; status: string; parts_mapping_complete: boolean } | null
    inspector?: { full_name: string } | null
    control_plan?: { model: string; revision_no: number; target_name?: string } | null
  }[]
  pendingGearboxes: { id: string; serial_number: string; model: string; parts_mapping_complete: boolean }[]
  controlPlans: (ControlPlanRevision & { control_plan_items: ControlPlanItem[] })[]
  materials: { id: string; code: string; name: string }[]
}

const RESULT_ICON = {
  ok: <CheckCircle className="w-4 h-4 text-emerald-600" />,
  ret: <XCircle className="w-4 h-4 text-red-600" />,
  beklemede: <Clock className="w-4 h-4 text-amber-500" />,
}
const RESULT_BADGE: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ret: 'bg-red-100 text-red-700 border-red-200',
  beklemede: 'bg-amber-100 text-amber-700 border-amber-200',
}

function evaluateMeasurement(value: number | null, item: ControlPlanItem): InspectionResult {
  if (value === null || isNaN(value)) return 'beklemede'
  if (item.lower_limit !== null && item.lower_limit !== undefined && value < item.lower_limit) return 'ret'
  if (item.upper_limit !== null && item.upper_limit !== undefined && value > item.upper_limit) return 'ret'
  return 'ok'
}

interface MeasurementEntry {
  control_plan_item_id: string
  measured_value: string
  result: InspectionResult
}

const emptyItemForm = {
  name: '', characteristic: '', nominal_value: '', lower_limit: '', upper_limit: '',
  unit: 'mm', measurement_method: '', equipment: '', is_critical: false, is_100_percent: true,
}

export function KaliteKontrolClient({ inspections, pendingGearboxes, controlPlans: initPlans, materials }: Props) {
  const [plans, setPlans] = useState(initPlans)
  const [planOpen, setPlanOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Inline ölçüm ekleme
  const [addingItemPlanId, setAddingItemPlanId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState(emptyItemForm)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Plan oluşturma
  const [planTarget, setPlanTarget] = useState<string>('A')
  const [planDesc, setPlanDesc] = useState('')

  // QC State
  const [qcMode, setQcMode] = useState(false)
  const [qcGearbox, setQcGearbox] = useState<Props['pendingGearboxes'][0] | null>(null)
  const [qcPlan, setQcPlan] = useState<(typeof plans)[0] | null>(null)
  const [measurements, setMeasurements] = useState<Record<string, MeasurementEntry>>({})
  const [qcComments, setQcComments] = useState('')

  const router = useRouter()
  const supabase = createClient()

  // Target options: models + materials
  const targetOptions = [
    { value: 'A', label: 'Model A' },
    { value: 'B', label: 'Model B' },
    { value: 'C', label: 'Model C' },
    ...materials.map(m => ({ value: `mat:${m.id}`, label: `${m.code} - ${m.name}` })),
  ]

  // === KONTROL PLANI CRUD ===
  const handleCreatePlan = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const isModel = ['A', 'B', 'C'].includes(planTarget)
      const modelVal = isModel ? planTarget : null
      const materialId = planTarget.startsWith('mat:') ? planTarget.replace('mat:', '') : null
      const targetName = isModel ? `Model ${planTarget}` : targetOptions.find(o => o.value === planTarget)?.label || planTarget

      const existing = plans.filter(p => isModel ? p.model === planTarget : p.material_id === materialId)
      const maxRev = existing.reduce((max, p) => Math.max(max, p.revision_no), 0)

      if (isModel) {
        await supabase.from('control_plan_revisions').update({ is_active: false }).eq('model', planTarget).eq('is_active', true)
      } else if (materialId) {
        await supabase.from('control_plan_revisions').update({ is_active: false }).eq('material_id', materialId).eq('is_active', true)
      }

      const { data, error } = await supabase.from('control_plan_revisions').insert({
        model: modelVal, revision_no: maxRev + 1, description: planDesc, is_active: true,
        created_by: user?.id, target_type: isModel ? 'model' : 'material',
        target_name: targetName, material_id: materialId,
      }).select('*, control_plan_items(*)').single()
      if (error) throw error

      setPlans([data, ...plans.filter(p => {
        if (isModel) return p.model !== planTarget
        return p.material_id !== materialId
      })])
      setPlanOpen(false)
      setPlanDesc('')
      toast.success(`Kontrol planı oluşturuldu: ${targetName}`)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  // Inline ölçüm satırı ekleme
  const startAddItem = (planId: string) => {
    setAddingItemPlanId(planId)
    setEditingItemId(null)
    setItemForm(emptyItemForm)
  }

  const handleAddItem = async () => {
    if (!addingItemPlanId || !itemForm.name) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('control_plan_items').insert({
        control_plan_id: addingItemPlanId, name: itemForm.name,
        characteristic: itemForm.characteristic || null,
        nominal_value: itemForm.nominal_value ? parseFloat(itemForm.nominal_value) : null,
        lower_limit: itemForm.lower_limit ? parseFloat(itemForm.lower_limit) : null,
        upper_limit: itemForm.upper_limit ? parseFloat(itemForm.upper_limit) : null,
        unit: itemForm.unit, measurement_method: itemForm.measurement_method || null,
        equipment: itemForm.equipment || null,
        is_critical: itemForm.is_critical, is_100_percent: itemForm.is_100_percent,
      }).select('*').single()
      if (error) throw error

      setPlans(plans.map(p => p.id === addingItemPlanId ? { ...p, control_plan_items: [...p.control_plan_items, data] } : p))
      // Formu temizle ama ekleme modunda kal (hızlı ardışık ekleme)
      setItemForm(emptyItemForm)
      toast.success('Ölçüm satırı eklendi')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const startEditItem = (item: ControlPlanItem) => {
    setEditingItemId(item.id)
    setAddingItemPlanId(null)
    setItemForm({
      name: item.name, characteristic: item.characteristic || '',
      nominal_value: item.nominal_value !== null && item.nominal_value !== undefined ? String(item.nominal_value) : '',
      lower_limit: item.lower_limit !== null && item.lower_limit !== undefined ? String(item.lower_limit) : '',
      upper_limit: item.upper_limit !== null && item.upper_limit !== undefined ? String(item.upper_limit) : '',
      unit: item.unit, measurement_method: item.measurement_method || '',
      equipment: item.equipment || '', is_critical: item.is_critical, is_100_percent: item.is_100_percent,
    })
  }

  const handleUpdateItem = async () => {
    if (!editingItemId) return
    setLoading(true)
    try {
      const { error } = await supabase.from('control_plan_items').update({
        name: itemForm.name, characteristic: itemForm.characteristic || null,
        nominal_value: itemForm.nominal_value ? parseFloat(itemForm.nominal_value) : null,
        lower_limit: itemForm.lower_limit ? parseFloat(itemForm.lower_limit) : null,
        upper_limit: itemForm.upper_limit ? parseFloat(itemForm.upper_limit) : null,
        unit: itemForm.unit, measurement_method: itemForm.measurement_method || null,
        equipment: itemForm.equipment || null,
        is_critical: itemForm.is_critical, is_100_percent: itemForm.is_100_percent,
      }).eq('id', editingItemId)
      if (error) throw error

      setPlans(plans.map(p => ({
        ...p,
        control_plan_items: p.control_plan_items.map(i => i.id === editingItemId ? {
          ...i, name: itemForm.name, characteristic: itemForm.characteristic || null,
          nominal_value: itemForm.nominal_value ? parseFloat(itemForm.nominal_value) : null,
          lower_limit: itemForm.lower_limit ? parseFloat(itemForm.lower_limit) : null,
          upper_limit: itemForm.upper_limit ? parseFloat(itemForm.upper_limit) : null,
          unit: itemForm.unit, measurement_method: itemForm.measurement_method || null,
          equipment: itemForm.equipment || null,
          is_critical: itemForm.is_critical, is_100_percent: itemForm.is_100_percent,
        } as ControlPlanItem : i),
      })))
      setEditingItemId(null)
      setItemForm(emptyItemForm)
      toast.success('Ölçüm güncellendi')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleDeleteItem = async (planId: string, itemId: string) => {
    if (!confirm('Bu ölçüm satırını silmek istediğinize emin misiniz?')) return
    await supabase.from('control_plan_items').delete().eq('id', itemId)
    setPlans(plans.map(p => p.id === planId ? { ...p, control_plan_items: p.control_plan_items.filter(i => i.id !== itemId) } : p))
    toast.success('Satır silindi')
  }

  const handleDeletePlan = async (planId: string, name: string) => {
    if (!confirm(`"${name}" kontrol planını silmek istediğinize emin misiniz?`)) return
    await supabase.from('control_plan_revisions').delete().eq('id', planId)
    setPlans(plans.filter(p => p.id !== planId))
    toast.success('Kontrol planı silindi')
  }

  // === QC EXECUTION ===
  const startQC = (gearbox: Props['pendingGearboxes'][0]) => {
    const plan = plans.find(p => p.model === gearbox.model && p.target_type === 'model' && p.is_active)
    if (!plan) {
      toast.error(`${MODEL_LABELS[gearbox.model as GearboxModel]} için aktif kontrol planı yok!`)
      return
    }
    setQcGearbox(gearbox)
    setQcPlan(plan)
    setMeasurements(
      Object.fromEntries(plan.control_plan_items.map(item => [
        item.id,
        { control_plan_item_id: item.id, measured_value: '', result: 'beklemede' as InspectionResult },
      ]))
    )
    setQcComments('')
    setQcMode(true)
  }

  const startQCFromPlan = (plan: (typeof plans)[0]) => {
    const gearbox = pendingGearboxes.find(g => g.model === plan.model)
    if (!gearbox) {
      toast.error('Bu model için kontrol bekleyen şanzıman yok')
      return
    }
    startQC(gearbox)
  }

  const handleValueChange = useCallback((itemId: string, value: string) => {
    const item = qcPlan?.control_plan_items.find(i => i.id === itemId)
    if (!item) return
    const numVal = value ? parseFloat(value) : null
    const result = evaluateMeasurement(numVal, item)
    setMeasurements(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], measured_value: value, result },
    }))
  }, [qcPlan])

  const handleSubmitQC = async (isDraft: boolean) => {
    if (!qcGearbox || !qcPlan) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const mVals = Object.values(measurements)
      const hasRet = mVals.some(m => m.result === 'ret')
      const hasCriticalRet = qcPlan.control_plan_items.some(item =>
        item.is_critical && measurements[item.id]?.result === 'ret'
      )
      const overallResult: InspectionResult = isDraft ? 'beklemede' : (hasRet || hasCriticalRet ? 'ret' : 'ok')

      const { data: inspection, error: inspError } = await supabase.from('quality_inspections').insert({
        gearbox_id: qcGearbox.id, control_plan_id: qcPlan.id,
        inspector_id: user?.id, overall_result: overallResult,
        comments: qcComments || null, is_draft: isDraft,
      }).select().single()
      if (inspError) throw inspError

      const measurementRows = mVals.filter(m => m.measured_value).map(m => ({
        inspection_id: inspection.id, control_plan_item_id: m.control_plan_item_id,
        measured_value: parseFloat(m.measured_value), result: m.result,
      }))
      if (measurementRows.length > 0) {
        const { error: mError } = await supabase.from('quality_measurements').insert(measurementRows)
        if (mError) throw mError
      }

      if (!isDraft && overallResult === 'ok') {
        await supabase.from('gearboxes').update({ status: 'stokta' }).eq('id', qcGearbox.id)
        toast.success('Kalite kontrol GEÇTİ - Ürün stoğa alındı')
      } else if (!isDraft && overallResult === 'ret') {
        await supabase.from('gearboxes').update({ status: 'revizyon_iade' }).eq('id', qcGearbox.id)
        toast.error('Kalite kontrol RED - Revizyon/İade')
      } else {
        toast.success('Taslak kaydedildi')
      }

      setQcMode(false)
      setQcGearbox(null)
      setQcPlan(null)
      setMeasurements({})
      setQcComments('')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  // Inline satır render - ekleme veya düzenleme formu
  const renderInlineItemRow = (planId: string) => (
    <TableRow className="bg-blue-50/50">
      <TableCell>
        <Checkbox checked={itemForm.is_critical} onCheckedChange={v => setItemForm({ ...itemForm, is_critical: v as boolean })} />
      </TableCell>
      <TableCell>
        <Input className="h-8 text-sm" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Ölçüm adı *" />
      </TableCell>
      <TableCell>
        <Input className="h-8 text-sm font-mono w-20" type="number" step="0.001" value={itemForm.nominal_value} onChange={e => setItemForm({ ...itemForm, nominal_value: e.target.value })} placeholder="0.00" />
      </TableCell>
      <TableCell>
        <Input className="h-8 text-sm font-mono w-20" type="number" step="0.001" value={itemForm.lower_limit} onChange={e => setItemForm({ ...itemForm, lower_limit: e.target.value })} placeholder="0.00" />
      </TableCell>
      <TableCell>
        <Input className="h-8 text-sm font-mono w-20" type="number" step="0.001" value={itemForm.upper_limit} onChange={e => setItemForm({ ...itemForm, upper_limit: e.target.value })} placeholder="0.00" />
      </TableCell>
      <TableCell>
        <Input className="h-8 text-sm w-16" value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} />
      </TableCell>
      <TableCell>
        <Input className="h-8 text-sm" value={itemForm.measurement_method} onChange={e => setItemForm({ ...itemForm, measurement_method: e.target.value })} placeholder="Yöntem" />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" disabled={loading || !itemForm.name}
            onClick={editingItemId ? handleUpdateItem : handleAddItem}>
            <Check className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setAddingItemPlanId(null); setEditingItemId(null); setItemForm(emptyItemForm) }}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )

  // === QC MODE RENDER ===
  if (qcMode && qcGearbox && qcPlan) {
    const items = qcPlan.control_plan_items
    const qcResult: InspectionResult = Object.values(measurements).some(m => m.result === 'ret') ? 'ret'
      : Object.values(measurements).every(m => m.result === 'ok') ? 'ok' : 'beklemede'
    const allFilled = Object.values(measurements).every(m => m.measured_value !== '')

    return (
      <div className="space-y-6">
        <div>
          <button onClick={() => setQcMode(false)} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Geri
          </button>
          <h1 className="text-2xl font-bold">Kalite Kontrol</h1>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant="outline" className="font-mono text-base px-3 py-1">{qcGearbox.serial_number}</Badge>
            <Badge variant="outline">{MODEL_LABELS[qcGearbox.model as GearboxModel]}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Ölçüm Girişi</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Ölçüm</TableHead>
                      <TableHead>Spesifikasyon</TableHead>
                      <TableHead className="w-40">Gerçek Değer</TableHead>
                      <TableHead className="text-center w-24">Sonuç</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(item => {
                      const m = measurements[item.id]
                      return (
                        <TableRow key={item.id} className={m?.result === 'ret' ? 'bg-red-50 border-l-4 border-l-red-500' : ''}>
                          <TableCell>{item.is_critical && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}</TableCell>
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            {item.characteristic && <div className="text-xs text-muted-foreground">{item.characteristic}</div>}
                            {m?.result === 'ret' && <div className="text-xs text-red-600 font-medium mt-0.5">Tolerans dışı!</div>}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {item.nominal_value !== null && item.nominal_value !== undefined ? `${item.nominal_value} ` : ''}
                            {item.lower_limit !== null && item.lower_limit !== undefined && item.upper_limit !== null && item.upper_limit !== undefined
                              ? `(${item.lower_limit} - ${item.upper_limit})`
                              : item.upper_limit !== null && item.upper_limit !== undefined ? `Max ${item.upper_limit}` : ''}
                            {' '}{item.unit}
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.001"
                              className={`font-mono text-right ${m?.result === 'ret' ? 'border-red-300 text-red-600 font-bold' : ''}`}
                              placeholder="---" value={m?.measured_value || ''} onChange={e => handleValueChange(item.id, e.target.value)} />
                          </TableCell>
                          <TableCell className="text-center">{RESULT_ICON[m?.result || 'beklemede']}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Kontrol Sonucu</CardTitle></CardHeader>
              <CardContent>
                <div className={`flex items-center justify-between p-4 rounded-lg border ${qcResult === 'ok' ? 'bg-emerald-50 border-emerald-200' : qcResult === 'ret' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center gap-3">
                    {qcResult === 'ok' ? <CheckCircle className="w-8 h-8 text-emerald-600" /> : qcResult === 'ret' ? <XCircle className="w-8 h-8 text-red-600" /> : <Clock className="w-8 h-8 text-amber-500" />}
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">GENEL SONUÇ</div>
                      <div className={`text-xl font-bold ${qcResult === 'ok' ? 'text-emerald-700' : qcResult === 'ret' ? 'text-red-700' : 'text-amber-700'}`}>
                        {qcResult === 'ok' ? 'GEÇTİ' : qcResult === 'ret' ? 'RED' : 'BEKLİYOR'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Toplam</span><span className="font-medium">{items.length}</span></div>
                  <div className="flex justify-between"><span className="text-emerald-600">Geçen</span><span>{Object.values(measurements).filter(m => m.result === 'ok').length}</span></div>
                  <div className="flex justify-between"><span className="text-red-600">Red</span><span>{Object.values(measurements).filter(m => m.result === 'ret').length}</span></div>
                  <div className="flex justify-between"><span className="text-amber-600">Bekleyen</span><span>{Object.values(measurements).filter(m => m.result === 'beklemede').length}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Yorum</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={qcComments} onChange={e => setQcComments(e.target.value)} placeholder="Kontrol notları..." rows={3} />
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm sticky bottom-0">
          <p className="text-sm text-muted-foreground">{!allFilled && 'Tüm ölçümler doldurulmadan kayıt tamamlanamaz.'}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleSubmitQC(true)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Taslak Kaydet
            </Button>
            <Button onClick={() => handleSubmitQC(false)} disabled={loading || !allFilled}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Kaydet ve Onayla
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // === MAIN RENDER ===
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kalite Kontrol</h1>
          <p className="text-sm text-muted-foreground mt-1">Kontrol planları, ölçüm ve kalite kayıtları</p>
        </div>
      </div>

      <Tabs defaultValue="kontrol">
        <TabsList>
          <TabsTrigger value="kontrol"><ShieldCheck className="w-4 h-4 mr-1" />Kalite Kontrol</TabsTrigger>
          <TabsTrigger value="planlar"><ClipboardList className="w-4 h-4 mr-1" />Kontrol Planları</TabsTrigger>
          <TabsTrigger value="gecmis"><Eye className="w-4 h-4 mr-1" />Geçmiş Kayıtlar</TabsTrigger>
        </TabsList>

        {/* KALİTE KONTROL SEKMESİ */}
        <TabsContent value="kontrol">
          {pendingGearboxes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Kontrol Bekleyen Şanzımanlar ({pendingGearboxes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingGearboxes.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:border-primary/50 transition-colors">
                      <div>
                        <p className="font-mono font-bold">{g.serial_number}</p>
                        <p className="text-xs text-muted-foreground">{MODEL_LABELS[g.model as GearboxModel]}</p>
                      </div>
                      <Button size="sm" onClick={() => startQC(g)}>
                        <ShieldCheck className="w-3 h-3 mr-1" />Kontrole Başla
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-300" />
                <p>Kontrol bekleyen şanzıman yok</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* KONTROL PLANLARI SEKMESİ */}
        <TabsContent value="planlar">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={planOpen} onOpenChange={setPlanOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" />Kontrol Planı Hazırla</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Yeni Kontrol Planı</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Ürün / Model / Malzeme Seçin</Label>
                      <Select value={planTarget} onValueChange={setPlanTarget}>
                        <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">Model A</SelectItem>
                          <SelectItem value="B">Model B</SelectItem>
                          <SelectItem value="C">Model C</SelectItem>
                          {materials.map(m => (
                            <SelectItem key={m.id} value={`mat:${m.id}`}>{m.code} - {m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Açıklama</Label>
                      <Input value={planDesc} onChange={e => setPlanDesc(e.target.value)} placeholder="Kontrol planı açıklaması" />
                    </div>
                    <Button onClick={handleCreatePlan} disabled={loading} className="w-full">
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Plan Oluştur
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {plans.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Henüz kontrol planı yok</CardContent></Card>
            ) : plans.map(plan => (
              <Card key={plan.id}>
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-sm font-semibold">{plan.target_name || (plan.model ? MODEL_LABELS[plan.model] : 'Plan')}</CardTitle>
                      <p className="text-xs text-muted-foreground">{plan.description || ''} &bull; {plan.control_plan_items.length} ölçüm</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {plan.model && pendingGearboxes.some(g => g.model === plan.model) && (
                      <Button size="sm" variant="outline" onClick={() => startQCFromPlan(plan)}>
                        <ShieldCheck className="w-3 h-3 mr-1" />Kontrol
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => startAddItem(plan.id)}>
                      <Plus className="w-3 h-3 mr-1" />Ölçüm Ekle
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeletePlan(plan.id, plan.target_name || 'Plan')}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-10">Kritik</TableHead>
                        <TableHead>Ölçüm Adı</TableHead>
                        <TableHead className="w-24">Nominal</TableHead>
                        <TableHead className="w-24">Alt Limit</TableHead>
                        <TableHead className="w-24">Üst Limit</TableHead>
                        <TableHead className="w-20">Birim</TableHead>
                        <TableHead>Yöntem</TableHead>
                        <TableHead className="text-right w-24">İşlem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.control_plan_items.length === 0 && addingItemPlanId !== plan.id ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-4 text-muted-foreground text-sm">
                            Ölçüm tanımlanmadı - &quot;Ölçüm Ekle&quot; ile başlayın
                          </TableCell>
                        </TableRow>
                      ) : plan.control_plan_items.map(item => (
                        editingItemId === item.id ? (
                          renderInlineItemRow(plan.id)
                        ) : (
                          <TableRow key={item.id} className="text-sm">
                            <TableCell>{item.is_critical && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="font-mono text-sm">{item.nominal_value ?? '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{item.lower_limit ?? '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{item.upper_limit ?? '-'}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.measurement_method || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => startEditItem(item)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDeleteItem(plan.id, item.id)}>
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      ))}
                      {addingItemPlanId === plan.id && renderInlineItemRow(plan.id)}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* GEÇMİŞ KAYITLAR SEKMESİ */}
        <TabsContent value="gecmis">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seri No</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Kontrol Eden</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Sonuç</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Kayıt yok</TableCell></TableRow>
                  ) : inspections.map(insp => (
                    <TableRow key={insp.id}>
                      <TableCell className="font-mono font-medium">{insp.gearbox?.serial_number}</TableCell>
                      <TableCell><Badge variant="outline">{MODEL_LABELS[insp.gearbox?.model as keyof typeof MODEL_LABELS] || '-'}</Badge></TableCell>
                      <TableCell>{insp.inspector?.full_name || '-'}</TableCell>
                      <TableCell>{new Date(insp.inspection_date).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {RESULT_ICON[insp.overall_result as keyof typeof RESULT_ICON]}
                          <Badge className={RESULT_BADGE[insp.overall_result]} variant="outline">
                            {insp.overall_result === 'ok' ? 'GEÇTİ' : insp.overall_result === 'ret' ? 'RED' : 'BEKLİYOR'}
                          </Badge>
                          {insp.is_draft && <Badge variant="secondary" className="text-xs">Taslak</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/kalite-kontrol/${insp.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="w-4 h-4 mr-1" />Detay</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
