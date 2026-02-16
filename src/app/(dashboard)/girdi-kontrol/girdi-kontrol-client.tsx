'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { ControlPlanRevision, ControlPlanItem, InspectionResult } from '@/lib/types'
import {
  ShieldCheck, ClipboardCheck, Eye, CheckCircle, XCircle, Clock,
  Star, Loader2, Send, Save, ArrowLeft, Package, AlertTriangle, ShieldAlert,
  RotateCcw, CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'
import { DateRangeFilter } from '@/components/date-range-filter'

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

interface Receipt {
  id: string
  material_id: string
  supplier_id?: string
  invoice_number?: string
  lot_number?: string
  quantity: number
  receipt_date: string
  status: string
  material?: { id: string; code: string; name: string; unit: string } | null
  supplier?: { name: string } | null
}

interface InspectionRecord {
  id: string
  material_id: string
  stock_entry_id?: string
  receipt_id?: string
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
    notes?: string
    result: string
    control_plan_item?: {
      name: string; nominal_value?: number; lower_limit?: number; upper_limit?: number; unit: string; is_critical: boolean; sample_info?: string
    } | null
  }[]
}

interface QuarantineAction {
  id?: string
  decision: string
  notes?: string
  decided_at: string
  decided_by?: { full_name: string } | null
}

interface QuarantineItem {
  id: string
  material_id: string
  quantity: number
  reason?: string
  lot_number?: string
  invoice_number?: string
  quarantined_at: string
  status?: string
  material?: { code: string; name: string; unit: string } | null
  quarantine_actions?: QuarantineAction[]
}

interface Props {
  materialPlans: MaterialPlan[]
  recentReceipts: Receipt[]
  recentEntries: StockEntry[]
  inspections: InspectionRecord[]
  materials: { id: string; code: string; name: string; unit: string }[]
  quarantineItems: QuarantineItem[]
  dateRangeStart: string
  dateRangeEnd: string
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

function evaluateMeasurement(value: string | null, item: ControlPlanItem): InspectionResult {
  if (value === null || value === '') return 'beklemede'

  // Text-based nominal check (e.g., "M10")
  if (item.sample_info) {
    return value.trim().toLowerCase() === item.sample_info.trim().toLowerCase() ? 'ok' : 'ret'
  }

  // Numeric check with limits
  const numVal = parseFloat(value)
  if (isNaN(numVal)) return 'beklemede'
  if (item.lower_limit !== null && item.lower_limit !== undefined && numVal < item.lower_limit) return 'ret'
  if (item.upper_limit !== null && item.upper_limit !== undefined && numVal > item.upper_limit) return 'ret'
  return 'ok'
}

interface MeasurementEntry {
  control_plan_item_id: string
  measured_value: string
  result: InspectionResult
}

export function GirdiKontrolClient({ materialPlans, recentReceipts, recentEntries, inspections, materials, quarantineItems: initQuarantine, dateRangeStart, dateRangeEnd }: Props) {
  const [inspMode, setInspMode] = useState(false)
  const [detailInsp, setDetailInsp] = useState<InspectionRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [quarantineItems, setQuarantineItems] = useState(initQuarantine)
  const [quarantineModalOpen, setQuarantineModalOpen] = useState(false)
  const [quarantineNotesById, setQuarantineNotesById] = useState<Record<string, string>>({})
  useEffect(() => { setQuarantineItems(initQuarantine) }, [initQuarantine])

  // Kontrol başlat - tesellümden (receipt) seçim
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>('')
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

  const startInspection = (receipt?: Receipt) => {
    if (receipt) {
      const matId = receipt.material_id
      setSelectedMaterialId(matId)
      setSelectedReceiptId(receipt.id)
      setSelectedEntryId('')
      setInspQty(String(receipt.quantity))
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
    const result = evaluateMeasurement(value, item)
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
      const receipt = recentReceipts.find(r => r.id === selectedReceiptId)

      const { data: inspection, error } = await supabase.from('material_inspections').insert({
        material_id: selectedMaterialId,
        stock_entry_id: null,
        receipt_id: selectedReceiptId || null,
        control_plan_id: inspPlan.id,
        inspector_id: user?.id,
        overall_result: finalResult,
        comments: inspComments,
        lot_number: receipt?.lot_number || null,
        invoice_number: receipt?.invoice_number || null,
        quantity_inspected: inspQty ? parseFloat(inspQty) : null,
        is_draft: isDraft,
      }).select().single()
      if (error) throw error

      const measurementRows = Object.values(measurements).map(m => {
        const item = inspPlan?.control_plan_items.find(i => i.id === m.control_plan_item_id)
        const isTextItem = !!item?.sample_info
        return {
          inspection_id: inspection.id,
          control_plan_item_id: m.control_plan_item_id,
          measured_value: isTextItem ? null : (m.measured_value ? parseFloat(m.measured_value) : null),
          notes: isTextItem ? (m.measured_value || null) : null,
          result: m.result,
        }
      })
      const { error: mError } = await supabase.from('material_measurements').insert(measurementRows)
      if (mError) throw mError

      if (!isDraft && receipt) {
        if (finalResult === 'ok') {
          // Onaylı: Stok girişi oluştur, stoğu güncelle
          const qty = inspQty ? parseFloat(inspQty) : receipt.quantity
          const { data: stockEntry, error: entryErr } = await supabase.from('material_stock_entries').insert({
            material_id: selectedMaterialId,
            supplier_id: receipt.supplier_id || null,
            invoice_number: receipt.invoice_number || null,
            lot_number: receipt.lot_number || null,
            quantity: qty,
            remaining_quantity: qty,
            entry_date: receipt.receipt_date || new Date().toISOString().split('T')[0],
            created_by: user?.id,
          }).select().single()
          if (entryErr) throw entryErr

          await supabase.rpc('update_material_stock', { p_material_id: selectedMaterialId, p_quantity: qty, p_movement_type: 'giris' })
          await supabase.from('stock_movements').insert({
            material_id: selectedMaterialId,
            stock_entry_id: stockEntry.id,
            movement_type: 'giris',
            quantity: qty,
            notes: `Girdi kontrol onayı - İrs: ${receipt.invoice_number || '-'}, Lot: ${receipt.lot_number || '-'}`,
            created_by: user?.id,
          })
          await supabase.from('material_receipts').update({ status: 'onaylandi' }).eq('id', receipt.id)
          toast.success('Girdi kontrolü GEÇTİ - Malzeme stoğa eklendi')
        } else {
          // Red: Karantinaya gönder
          const qty = inspQty ? parseFloat(inspQty) : receipt.quantity
          await supabase.from('material_quarantine').insert({
            material_id: selectedMaterialId,
            receipt_id: receipt.id,
            inspection_id: inspection.id,
            quantity: qty,
            reason: inspComments || 'Girdi kontrol RED',
            lot_number: receipt.lot_number || null,
            invoice_number: receipt.invoice_number || null,
            status: 'karantinada',
          })
          await supabase.from('material_receipts').update({ status: 'reddedildi' }).eq('id', receipt.id)
          toast.warning('Girdi kontrolü RED - Malzeme karantinaya alındı')
        }
      } else if (isDraft) {
        await supabase.from('material_receipts').update({ status: 'kontrol_bekliyor' }).eq('id', selectedReceiptId).maybeSingle()
        toast.success('Taslak kaydedildi')
      }

      setInspMode(false)
      setSelectedMaterialId('')
      setSelectedReceiptId('')
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

  // Karantina kararı (İade / Kullan)
  const handleQuarantineDecision = async (decision: 'iade' | 'kullan', item: QuarantineItem) => {
    setLoading(true)
    const notes = quarantineNotesById[item.id] || ''
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('material_quarantine_actions').insert({
        quarantine_id: item.id,
        decision,
        notes: notes || null,
        decided_by: user?.id,
      })
      const newStatus = decision === 'iade' ? 'iade_edildi' : 'kullanildi'
      const { error: updateErr } = await supabase.from('material_quarantine').update({ status: newStatus }).eq('id', item.id)
      if (updateErr) throw updateErr
      if (decision === 'kullan') {
        const qty = item.quantity
        const entryNotes = `Karantina - Kullan kararı: ${notes || '-'}`
        const { data: entryData } = await supabase.from('material_stock_entries').insert({
          material_id: item.material_id,
          quantity: qty,
          remaining_quantity: qty,
          entry_date: new Date().toISOString().split('T')[0],
          invoice_number: item.invoice_number || null,
          lot_number: item.lot_number || null,
          quarantine_id: item.id,
          notes: entryNotes,
          created_by: user?.id,
        }).select('id').single()
        if (entryData) {
          await supabase.rpc('update_material_stock', { p_material_id: item.material_id, p_quantity: qty, p_movement_type: 'giris' })
          await supabase.from('stock_movements').insert({
            material_id: item.material_id,
            stock_entry_id: entryData.id,
            movement_type: 'giris',
            quantity: qty,
            notes: `Karantina kullan kararı - İrs: ${item.invoice_number || '-'}, Lot: ${item.lot_number || '-'}`,
            created_by: user?.id,
          })
        }
      }
      const remaining = quarantineItems.filter(q => q.id !== item.id)
      setQuarantineItems(remaining)
      setQuarantineNotesById(prev => { const next = { ...prev }; delete next[item.id]; return next })
      if (remaining.length === 0) setQuarantineModalOpen(false)
      toast.success(decision === 'iade' ? 'Malzeme iade edildi olarak işaretlendi' : 'Malzeme kullanıma alındı ve stoğa eklendi')
      // Kısa gecikme ile refresh - DB güncellenmesi tamamlansın
      await new Promise(r => setTimeout(r, 500))
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Karar kaydedilemedi')
    } finally { setLoading(false) }
  }

  // Materials with control plans
  const materialsWithPlans = materials.filter(m => materialPlans.some(p => p.material_id === m.id))
  const materialsWithoutPlans = materials.filter(m => !materialPlans.some(p => p.material_id === m.id))

  // === KONTROL MODU ===
  if (inspMode && inspPlan) {
    const items = inspPlan.control_plan_items
    const selMat = materials.find(m => m.id === selectedMaterialId)
    const selReceipt = recentReceipts.find(r => r.id === selectedReceiptId)

    return (
      <div className="space-y-6">
        <div>
          <button onClick={() => setInspMode(false)} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Geri
          </button>
          <h1 className="text-2xl font-bold">Girdi Kontrol</h1>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant="outline" className="font-mono text-base px-3 py-1">{selMat?.code} - {selMat?.name}</Badge>
            {selReceipt && <Badge variant="secondary">İrsaliye: {selReceipt.invoice_number || '-'} | Lot: {selReceipt.lot_number || '-'}</Badge>}
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
                            {item.sample_info
                              ? <><span className="font-semibold">{item.sample_info}</span> <span className="text-xs text-muted-foreground">(yazı eşleşmesi)</span></>
                              : <>
                                  {item.nominal_value !== null ? `${item.nominal_value} ` : ''}
                                  {item.lower_limit !== null && item.upper_limit !== null
                                    ? `(${item.lower_limit} - ${item.upper_limit})`
                                    : item.upper_limit !== null ? `Max ${item.upper_limit}` : ''}
                                  {' '}{item.unit}
                                </>
                            }
                          </TableCell>
                          <TableCell>
                            <Input
                              type={item.sample_info ? 'text' : 'number'}
                              step={item.sample_info ? undefined : '0.001'}
                              className={`font-mono ${item.sample_info ? 'text-left' : 'text-right'} ${m?.result === 'ret' ? 'border-red-300 text-red-600 font-bold' : ''}`}
                              placeholder={item.sample_info || '---'}
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
                      {qm.control_plan_item?.sample_info
                        ? <span className="font-semibold">{qm.control_plan_item.sample_info}</span>
                        : <>
                            {qm.control_plan_item?.nominal_value !== null ? `${qm.control_plan_item?.nominal_value} ` : ''}
                            {qm.control_plan_item?.lower_limit !== null && qm.control_plan_item?.upper_limit !== null
                              ? `(${qm.control_plan_item?.lower_limit} - ${qm.control_plan_item?.upper_limit})`
                              : ''} {qm.control_plan_item?.unit}
                          </>
                      }
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${qm.result === 'ret' ? 'text-red-600' : ''}`}>{qm.notes || (qm.measured_value ?? '-')}</TableCell>
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
        <div className="flex items-center gap-2">
          <DateRangeFilter start={dateRangeStart} end={dateRangeEnd} label="Kontrol Tarihi" />
          <Button variant="outline" className={quarantineItems.length > 0 ? 'border-red-300 text-red-700' : ''} onClick={() => setQuarantineModalOpen(true)}>
            <ShieldAlert className="w-4 h-4 mr-2" />Karantina ({quarantineItems.length})
          </Button>
          {/* Karantina Modal - Full overlay */}
          {quarantineModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setQuarantineModalOpen(false); setQuarantineNotesById({}) }}>
              <div
                className="bg-background w-[90vw] max-w-[900px] min-h-[500px] max-h-[85vh] rounded-xl border shadow-2xl flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <ShieldAlert className="w-5 h-5 text-red-600" />
                      </div>
                      Karantina Alanı
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2 ml-[52px]">
                      Red edilen malzemeler. Her malzeme için <strong>İade Et</strong> veya <strong>Kullanıma Al</strong> kararı verin.
                    </p>
                  </div>
                  <button
                    onClick={() => { setQuarantineModalOpen(false); setQuarantineNotesById({}) }}
                    className="rounded-full p-2 hover:bg-muted transition-colors"
                  >
                    <XCircle className="w-6 h-6 text-muted-foreground" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-8 py-6">
                  {quarantineItems.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground">
                      <ShieldAlert className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg">Karantinada malzeme yok</p>
                      <p className="text-sm mt-1">Red edilen malzemeler burada görünecek.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {quarantineItems.map(q => (
                        <div key={q.id} className="rounded-xl border-2 border-red-200 bg-red-50/40 p-6">
                          {/* Malzeme bilgisi */}
                          <div className="flex items-start justify-between gap-6 mb-5">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-foreground">{q.material?.code} - {q.material?.name}</h3>
                              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-muted-foreground">
                                <span><strong>Miktar:</strong> {q.quantity} {q.material?.unit}</span>
                                <span><strong>İrsaliye:</strong> {q.invoice_number || '-'}</span>
                                <span><strong>Lot:</strong> {q.lot_number || '-'}</span>
                              </div>
                              <p className="text-sm text-red-600 font-semibold mt-2">Red nedeni: {q.reason || '-'}</p>
                            </div>
                            <Badge variant="destructive" className="text-sm px-3 py-1 shrink-0">Karantinada</Badge>
                          </div>

                          {/* Karar Notu */}
                          <div className="mb-5">
                            <Label className="text-sm font-medium text-foreground">Karar Notu (opsiyonel)</Label>
                            <Textarea
                              value={quarantineNotesById[q.id] || ''}
                              onChange={e => setQuarantineNotesById(prev => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder="Karar gerekçesini yazın..."
                              rows={2}
                              className="mt-2 resize-none bg-white"
                            />
                          </div>

                          {/* Karar Butonları */}
                          <div className="grid grid-cols-2 gap-4">
                            <Button
                              variant="outline"
                              size="lg"
                              className="h-14 text-base font-semibold border-2 border-amber-400 text-amber-700 hover:bg-amber-50 hover:border-amber-500"
                              onClick={() => handleQuarantineDecision('iade', q)}
                              disabled={loading}
                            >
                              {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <RotateCcw className="w-5 h-5 mr-2" />}
                              Tedarikçiye İade Et
                            </Button>
                            <button
                              className="flex-1 h-14 rounded-md text-base font-semibold inline-flex items-center justify-center shadow-md disabled:opacity-50"
                              style={{ backgroundColor: '#059669', color: '#ffffff' }}
                              onClick={() => handleQuarantineDecision('kullan', q)}
                              disabled={loading}
                            >
                              {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
                              Kullanıma Al (Stoğa Ekle)
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-8 py-4 border-t bg-muted/30 rounded-b-xl">
                  <p className="text-xs text-muted-foreground">
                    Toplam <strong>{quarantineItems.length}</strong> malzeme karantinada.
                    Kullanıma alınan malzemeler otomatik olarak stoğa eklenir.
                  </p>
                </div>
              </div>
            </div>
          )}
          <Button onClick={() => setInspMode(true)} disabled={recentReceipts.filter(r => r.status === 'teslim_alindi' || r.status === 'kontrol_bekliyor').length === 0}>
            <ClipboardCheck className="w-4 h-4 mr-2" />Kontrol Başlat
          </Button>
        </div>
      </div>

      {/* Kontrol planı olmayan malzeme uyarısı */}
      {materialsWithoutPlans.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {materialsWithoutPlans.length} malzemenin kontrol planı yok.
              Kontrol Planları sayfasından malzeme kontrol planı oluşturabilirsiniz.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Kontrol başlat - Tesellümden seçim */}
      {inspMode && !inspPlan && (
        <Card className="border-primary">
          <CardHeader><CardTitle>Kontrol Başlat - Tesellümden Seçin</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Malzemeler önce Tesellüm sayfasından teslim alınmalı. Aşağıdan tesellüme alınmış malzemeyi seçip kontrolü başlatın.</p>
            <div className="space-y-2">
              <Label>Tesellüm Kaydı Seçin</Label>
              <Select value={selectedReceiptId} onValueChange={v => { const r = recentReceipts.find(x => x.id === v); if (r) startInspection(r) }}>
                <SelectTrigger><SelectValue placeholder="Tesellüm kaydı seçin" /></SelectTrigger>
                <SelectContent>
                  {recentReceipts
                    .filter(r => r.status === 'teslim_alindi' || r.status === 'kontrol_bekliyor')
                    .map(r => {
                      const hasPlan = materialPlans.some(p => p.material_id === r.material_id)
                      return (
                        <SelectItem key={r.id} value={r.id} disabled={!hasPlan}>
                          {r.material?.code} - {r.material?.name} | İrs: {r.invoice_number || '-'} / Lot: {r.lot_number || '-'} ({r.quantity} {r.material?.unit}) {!hasPlan ? '(Plan yok)' : ''}
                        </SelectItem>
                      )
                    })}
                </SelectContent>
              </Select>
              {recentReceipts.filter(r => r.status === 'teslim_alindi' || r.status === 'kontrol_bekliyor').length === 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Tesellüm bekleyen malzeme yok. Tesellüm sayfasından tesellüm girişi yapın.</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setInspMode(false); setSelectedMaterialId(''); setSelectedReceiptId('') }}>İptal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="receipts">
        <TabsList>
          <TabsTrigger value="receipts"><Package className="w-4 h-4 mr-1" />Tesellüm Bekleyenler</TabsTrigger>
          <TabsTrigger value="history"><ShieldCheck className="w-4 h-4 mr-1" />Kontrol Kayıtları</TabsTrigger>
        </TabsList>

        <TabsContent value="receipts">
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
                    <TableHead>Teslim Tarihi</TableHead>
                    <TableHead>Kontrol Planı</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReceipts.filter(r => r.status === 'teslim_alindi' || r.status === 'kontrol_bekliyor').length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Tesellüm bekleyen malzeme yok. Tesellüm sayfasından tesellüm girişi yapın.</TableCell></TableRow>
                  ) : recentReceipts.filter(r => r.status === 'teslim_alindi' || r.status === 'kontrol_bekliyor').map(r => {
                    const hasPlan = materialPlans.some(p => p.material_id === r.material_id)
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.material?.code} - {r.material?.name}</TableCell>
                        <TableCell className="font-mono text-sm">{r.invoice_number || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{r.lot_number || '-'}</TableCell>
                        <TableCell>{r.supplier?.name || '-'}</TableCell>
                        <TableCell className="text-right font-bold">{r.quantity} {r.material?.unit}</TableCell>
                        <TableCell>{new Date(r.receipt_date).toLocaleDateString('tr-TR')}</TableCell>
                        <TableCell>
                          {hasPlan ? (
                            <Badge className="bg-emerald-100 text-emerald-700" variant="outline">Var</Badge>
                          ) : (
                            <Badge variant="secondary">Yok</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant={hasPlan ? 'outline' : 'ghost'} onClick={() => startInspection(r)} disabled={!hasPlan} title={!hasPlan ? 'Önce kontrol planı oluşturun' : ''}>
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
