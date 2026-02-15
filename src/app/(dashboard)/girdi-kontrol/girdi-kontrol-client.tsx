'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { ControlPlanRevision, ControlPlanItem, InspectionResult } from '@/lib/types'
import {
  ShieldCheck, ClipboardCheck, Eye, CheckCircle, XCircle, Clock,
  Star, Loader2, Send, Save, ArrowLeft, Package, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'

interface MaterialPlan extends ControlPlanRevision {
  control_plan_items: ControlPlanItem[]
}

interface StockEntry {
  id: string
  material_id: string
  invoice_number?: string
  lot_number?: string
  quantity: number
  remaining_quantity: number
  entry_date: string
  material?: { id: string; code: string; name: string; unit: string } | null
  supplier?: { name: string } | null
}

interface InspectionRecord {
  id: string
  material_id: string
  stock_entry_id?: string
  overall_result: string
  inspection_date: string
  comments?: string
  lot_number?: string
  invoice_number?: string
  quantity_inspected?: number
  is_draft: boolean
  material?: { code: string; name: string; unit: string } | null
  inspector?: { full_name: string } | null
  control_plan?: { target_name: string } | null
  material_measurements?: {
    id: string
    measured_value?: number
    result: string
    control_plan_item?: {
      name: string; nominal_value?: number; lower_limit?: number; upper_limit?: number; unit: string; is_critical: boolean
    } | null
  }[]
}

interface Props {
  materialPlans: MaterialPlan[]
  recentEntries: StockEntry[]
  inspections: InspectionRecord[]
  materials: { id: string; code: string; name: string; unit: string }[]
}

const RESULT_ICON: Record<string, React.ReactNode> = {
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

export function GirdiKontrolClient({ materialPlans, recentEntries, inspections, materials }: Props) {
  const [inspMode, setInspMode] = useState(false)
  const [detailInsp, setDetailInsp] = useState<InspectionRecord | null>(null)
  const [loading, setLoading] = useState(false)

  // Kontrol başlat
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [selectedEntryId, setSelectedEntryId] = useState<string>('')
  const [inspPlan, setInspPlan] = useState<MaterialPlan | null>(null)
  const [measurements, setMeasurements] = useState<Record<string, MeasurementEntry>>({})
  const [inspComments, setInspComments] = useState('')
  const [inspQty, setInspQty] = useState('')

  const router = useRouter()
  const supabase = createClient()

  // Malzeme seçildiğinde plan bul
  const handleMaterialSelect = (materialId: string) => {
    setSelectedMaterialId(materialId)
    const plan = materialPlans.find(p => p.material_id === materialId)
    if (plan && plan.control_plan_items.length > 0) {
      setInspPlan(plan)
      setMeasurements(
        Object.fromEntries(plan.control_plan_items.map(item => [
          item.id,
          { control_plan_item_id: item.id, measured_value: '', result: 'beklemede' as InspectionResult },
        ]))
      )
    } else {
      setInspPlan(null)
      setMeasurements({})
    }
  }

  const startInspection = (entry?: StockEntry) => {
    if (entry?.material) {
      const matId = entry.material.id
      setSelectedMaterialId(matId)
      setSelectedEntryId(entry.id)
      setInspQty(String(entry.quantity))
      // Plan bul ve set et
      const plan = materialPlans.find(p => p.material_id === matId)
      if (plan && plan.control_plan_items.length > 0) {
        setInspPlan(plan)
        setMeasurements(
          Object.fromEntries(plan.control_plan_items.map(item => [
            item.id,
            { control_plan_item_id: item.id, measured_value: '', result: 'beklemede' as InspectionResult },
          ]))
        )
      } else {
        setInspPlan(null)
        setMeasurements({})
      }
    }
    setInspMode(true)
  }

  const handleValueChange = useCallback((itemId: string, value: string) => {
    const item = inspPlan?.control_plan_items.find(i => i.id === itemId)
    if (!item) return
    const numVal = value ? parseFloat(value) : null
    const result = evaluateMeasurement(numVal, item)
    setMeasurements(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], measured_value: value, result },
    }))
  }, [inspPlan])

  const overallResult = (): InspectionResult => {
    const vals = Object.values(measurements)
    if (vals.length === 0) return 'beklemede'
    if (vals.some(m => m.result === 'beklemede')) return 'beklemede'
    const hasCriticalRet = vals.some(m => {
      const item = inspPlan?.control_plan_items.find(i => i.id === m.control_plan_item_id)
      return item?.is_critical && m.result === 'ret'
    })
    if (hasCriticalRet) return 'ret'
    if (vals.some(m => m.result === 'ret')) return 'ret'
    return 'ok'
  }

  const result = overallResult()
  const allFilled = Object.values(measurements).every(m => m.measured_value !== '')

  const handleSubmit = async (isDraft: boolean) => {
    if (!inspPlan || !selectedMaterialId) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const finalResult = isDraft ? 'beklemede' : result

      const entry = recentEntries.find(e => e.id === selectedEntryId)

      const { data: inspection, error } = await supabase.from('material_inspections').insert({
        material_id: selectedMaterialId,
        stock_entry_id: selectedEntryId || null,
        control_plan_id: inspPlan.id,
        inspector_id: user?.id,
        overall_result: finalResult,
        comments: inspComments,
        lot_number: entry?.lot_number || null,
        invoice_number: entry?.invoice_number || null,
        quantity_inspected: inspQty ? parseFloat(inspQty) : null,
        is_draft: isDraft,
      }).select().single()
      if (error) throw error

      const measurementRows = Object.values(measurements).map(m => ({
        inspection_id: inspection.id,
        control_plan_item_id: m.control_plan_item_id,
        measured_value: m.measured_value ? parseFloat(m.measured_value) : null,
        result: m.result,
      }))
      const { error: mError } = await supabase.from('material_measurements').insert(measurementRows)
      if (mError) throw mError

      if (!isDraft) {
        if (finalResult === 'ok') {
          toast.success('Girdi kontrolü GEÇTİ')
        } else {
          toast.warning('Girdi kontrolü RED - Malzeme kullanıma uygun değil')
        }
      } else {
        toast.success('Taslak kaydedildi')
      }

      setInspMode(false)
      setSelectedMaterialId('')
      setSelectedEntryId('')
      setInspPlan(null)
      setMeasurements({})
      setInspComments('')
      setInspQty('')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  // Materials with control plans
  const materialsWithPlans = materials.filter(m => materialPlans.some(p => p.material_id === m.id))
  const materialsWithoutPlans = materials.filter(m => !materialPlans.some(p => p.material_id === m.id))

  // === KONTROL MODU ===
  if (inspMode && inspPlan) {
    const items = inspPlan.control_plan_items
    const selMat = materials.find(m => m.id === selectedMaterialId)
    const selEntry = recentEntries.find(e => e.id === selectedEntryId)

    return (
      <div className="space-y-6">
        <div>
          <button onClick={() => setInspMode(false)} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Geri
          </button>
          <h1 className="text-2xl font-bold">Girdi Kontrol</h1>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant="outline" className="font-mono text-base px-3 py-1">{selMat?.code} - {selMat?.name}</Badge>
            {selEntry && <Badge variant="secondary">İrsaliye: {selEntry.invoice_number || '-'} | Lot: {selEntry.lot_number || '-'}</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5" />Ölçüm Girişi</CardTitle></CardHeader>
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
                            {item.nominal_value !== null ? `${item.nominal_value} ` : ''}
                            {item.lower_limit !== null && item.upper_limit !== null
                              ? `(${item.lower_limit} - ${item.upper_limit})`
                              : item.upper_limit !== null ? `Max ${item.upper_limit}` : ''}
                            {' '}{item.unit}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number" step="0.001"
                              className={`font-mono text-right ${m?.result === 'ret' ? 'border-red-300 text-red-600 font-bold' : ''}`}
                              placeholder="---"
                              value={m?.measured_value || ''}
                              onChange={e => handleValueChange(item.id, e.target.value)}
                            />
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
                <div className={`flex items-center justify-between p-4 rounded-lg border ${result === 'ok' ? 'bg-emerald-50 border-emerald-200' : result === 'ret' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center gap-3">
                    {result === 'ok' ? <CheckCircle className="w-8 h-8 text-emerald-600" /> : result === 'ret' ? <XCircle className="w-8 h-8 text-red-600" /> : <Clock className="w-8 h-8 text-amber-500" />}
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">GENEL SONUÇ</div>
                      <div className={`text-xl font-bold ${result === 'ok' ? 'text-emerald-700' : result === 'ret' ? 'text-red-700' : 'text-amber-700'}`}>
                        {result === 'ok' ? 'GEÇTİ' : result === 'ret' ? 'RED' : 'BEKLİYOR'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Toplam</span><span className="font-medium">{items.length}</span></div>
                  <div className="flex justify-between"><span className="text-emerald-600">Geçen</span><span>{Object.values(measurements).filter(m => m.result === 'ok').length}</span></div>
                  <div className="flex justify-between"><span className="text-red-600">Red</span><span>{Object.values(measurements).filter(m => m.result === 'ret').length}</span></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Detay</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Kontrol Edilen Miktar</Label>
                  <Input type="number" value={inspQty} onChange={e => setInspQty(e.target.value)} placeholder="Adet/kg/lt" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Yorum</Label>
                  <Textarea value={inspComments} onChange={e => setInspComments(e.target.value)} placeholder="Kontrol notları..." rows={3} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm sticky bottom-0">
          <p className="text-sm text-muted-foreground">{!allFilled && 'Tüm ölçümler doldurulmadan kayıt tamamlanamaz.'}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleSubmit(true)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Taslak
            </Button>
            <Button onClick={() => handleSubmit(false)} disabled={loading || !allFilled}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Kaydet ve Onayla
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // === DETAY GÖRÜNÜMÜ ===
  if (detailInsp) {
    return (
      <div className="space-y-6">
        <div>
          <button onClick={() => setDetailInsp(null)} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Geri
          </button>
          <h1 className="text-2xl font-bold">Girdi Kontrol Detayı</h1>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant="outline" className="font-mono">{detailInsp.material?.code} - {detailInsp.material?.name}</Badge>
            <Badge className={RESULT_BADGE[detailInsp.overall_result]} variant="outline">
              {detailInsp.overall_result === 'ok' ? 'GEÇTİ' : detailInsp.overall_result === 'ret' ? 'RED' : 'BEKLİYOR'}
            </Badge>
            {detailInsp.lot_number && <Badge variant="secondary">Lot: {detailInsp.lot_number}</Badge>}
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Ölçüm</TableHead>
                  <TableHead>Spesifikasyon</TableHead>
                  <TableHead className="text-right">Ölçülen</TableHead>
                  <TableHead className="text-center">Sonuç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detailInsp.material_measurements || []).map(qm => (
                  <TableRow key={qm.id} className={qm.result === 'ret' ? 'bg-red-50' : ''}>
                    <TableCell>{qm.control_plan_item?.is_critical && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}</TableCell>
                    <TableCell className="font-medium">{qm.control_plan_item?.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {qm.control_plan_item?.nominal_value !== null ? `${qm.control_plan_item?.nominal_value} ` : ''}
                      {qm.control_plan_item?.lower_limit !== null && qm.control_plan_item?.upper_limit !== null
                        ? `(${qm.control_plan_item?.lower_limit} - ${qm.control_plan_item?.upper_limit})`
                        : ''} {qm.control_plan_item?.unit}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${qm.result === 'ret' ? 'text-red-600' : ''}`}>{qm.measured_value ?? '-'}</TableCell>
                    <TableCell className="text-center">{RESULT_ICON[qm.result]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        {detailInsp.comments && (
          <Card><CardContent className="pt-4"><p className="text-sm"><strong>Yorum:</strong> {detailInsp.comments}</p></CardContent></Card>
        )}
      </div>
    )
  }

  // === ANA EKRAN ===
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Girdi Kontrol</h1>
          <p className="text-sm text-muted-foreground mt-1">Gelen malzeme muayene ve kalite kontrolü</p>
        </div>
        <Button onClick={() => setInspMode(true)}>
          <ClipboardCheck className="w-4 h-4 mr-2" />Kontrol Başlat
        </Button>
      </div>

      {/* Kontrol planı olmayan malzeme uyarısı */}
      {materialsWithoutPlans.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {materialsWithoutPlans.length} malzemenin kontrol planı yok.
              Kalite Kontrol &gt; Kontrol Planları sekmesinden malzeme kontrol planı oluşturabilirsiniz.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Kontrol başlat modali (inline) */}
      {inspMode && !inspPlan && (
        <Card className="border-primary">
          <CardHeader><CardTitle>Kontrol Başlat</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Malzeme Seçin</Label>
                <Select value={selectedMaterialId} onValueChange={handleMaterialSelect}>
                  <SelectTrigger><SelectValue placeholder="Malzeme seçin" /></SelectTrigger>
                  <SelectContent>
                    {materials.map(m => {
                      const hasPlan = materialPlans.some(p => p.material_id === m.id)
                      return (
                        <SelectItem key={m.id} value={m.id}>
                          {m.code} - {m.name} {!hasPlan ? '(Plan yok)' : ''}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {selectedMaterialId && !inspPlan && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Bu malzeme için kontrol planı yok. Kalite Kontrol &gt; Kontrol Planları sekmesinden oluşturun.</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Stok Girişi (opsiyonel)</Label>
                <Select value={selectedEntryId} onValueChange={v => { setSelectedEntryId(v); const entry = recentEntries.find(e => e.id === v); if (entry) setInspQty(String(entry.quantity)) }}>
                  <SelectTrigger><SelectValue placeholder="İrsaliye/Lot seçin" /></SelectTrigger>
                  <SelectContent>
                    {recentEntries
                      .filter(e => !selectedMaterialId || e.material_id === selectedMaterialId)
                      .map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          İrs: {e.invoice_number || '-'} / Lot: {e.lot_number || '-'} ({e.quantity} {e.material?.unit})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setInspMode(false); setSelectedMaterialId(''); setSelectedEntryId('') }}>İptal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries"><Package className="w-4 h-4 mr-1" />Son Stok Girişleri</TabsTrigger>
          <TabsTrigger value="history"><ShieldCheck className="w-4 h-4 mr-1" />Kontrol Kayıtları</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Malzeme</TableHead>
                    <TableHead>İrsaliye</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Tedarikçi</TableHead>
                    <TableHead className="text-right">Miktar</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Kontrol Planı</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEntries.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Stok girişi yok</TableCell></TableRow>
                  ) : recentEntries.map(e => {
                    const hasPlan = materialPlans.some(p => p.material_id === e.material_id)
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.material?.code} - {e.material?.name}</TableCell>
                        <TableCell className="font-mono text-sm">{e.invoice_number || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{e.lot_number || '-'}</TableCell>
                        <TableCell>{e.supplier?.name || '-'}</TableCell>
                        <TableCell className="text-right font-bold">{e.quantity} {e.material?.unit}</TableCell>
                        <TableCell>{new Date(e.entry_date).toLocaleDateString('tr-TR')}</TableCell>
                        <TableCell>
                          {hasPlan ? (
                            <Badge className="bg-emerald-100 text-emerald-700" variant="outline">Var</Badge>
                          ) : (
                            <Badge variant="secondary">Yok</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant={hasPlan ? 'outline' : 'ghost'} onClick={() => startInspection(e)} disabled={!hasPlan} title={!hasPlan ? 'Önce kontrol planı oluşturun' : ''}>
                            <ClipboardCheck className="w-3 h-3 mr-1" />{hasPlan ? 'Kontrol Et' : 'Plan Yok'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Malzeme</TableHead>
                    <TableHead>İrsaliye / Lot</TableHead>
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
                      <TableCell className="font-medium">{insp.material?.code} - {insp.material?.name}</TableCell>
                      <TableCell className="font-mono text-sm">{insp.invoice_number || '-'} / {insp.lot_number || '-'}</TableCell>
                      <TableCell>{insp.inspector?.full_name || '-'}</TableCell>
                      <TableCell>{new Date(insp.inspection_date).toLocaleDateString('tr-TR')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {RESULT_ICON[insp.overall_result]}
                          <Badge className={RESULT_BADGE[insp.overall_result]} variant="outline">
                            {insp.overall_result === 'ok' ? 'GEÇTİ' : insp.overall_result === 'ret' ? 'RED' : 'BEKLİYOR'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetailInsp(insp)}>
                          <Eye className="w-4 h-4 mr-1" />Detay
                        </Button>
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
