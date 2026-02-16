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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { MODEL_LABELS } from '@/lib/constants'
import type { ControlPlanRevision, ControlPlanItem, InspectionResult, GearboxModel } from '@/lib/types'
import {
  ShieldCheck, Eye, AlertTriangle, CheckCircle, XCircle, Clock,
  Loader2, Star, Send, Save, ArrowLeft, ClipboardList
} from 'lucide-react'
import { toast } from 'sonner'
import { DateRangeFilter } from '@/components/date-range-filter'

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
  dateRangeStart: string
  dateRangeEnd: string
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

function evaluateMeasurement(value: string | null, item: ControlPlanItem): InspectionResult {
  if (value === null || value === '') return 'beklemede'

  if (item.sample_info) {
    return value.trim().toLowerCase() === item.sample_info.trim().toLowerCase() ? 'ok' : 'ret'
  }

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

export function KaliteKontrolClient({ inspections, pendingGearboxes, controlPlans: plans, materials, dateRangeStart, dateRangeEnd }: Props) {
  const [loading, setLoading] = useState(false)

  // === QC State ===
  const [qcMode, setQcMode] = useState(false)
  const [qcGearbox, setQcGearbox] = useState<Props['pendingGearboxes'][0] | null>(null)
  const [qcPlan, setQcPlan] = useState<(typeof plans)[0] | null>(null)
  const [measurements, setMeasurements] = useState<Record<string, MeasurementEntry>>({})
  const [qcComments, setQcComments] = useState('')

  const router = useRouter()
  const supabase = createClient()

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

  const handleValueChange = useCallback((itemId: string, value: string) => {
    const item = qcPlan?.control_plan_items.find(i => i.id === itemId)
    if (!item) return
    const result = evaluateMeasurement(value, item)
    setMeasurements(prev => ({ ...prev, [itemId]: { ...prev[itemId], measured_value: value, result } }))
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

      const measurementRows = mVals.filter(m => m.measured_value).map(m => {
        const item = qcPlan?.control_plan_items.find(i => i.id === m.control_plan_item_id)
        const isTextItem = !!item?.sample_info
        return {
          inspection_id: inspection.id, control_plan_item_id: m.control_plan_item_id,
          measured_value: isTextItem ? null : (m.measured_value ? parseFloat(m.measured_value) : null),
          notes: isTextItem ? (m.measured_value || null) : null,
          result: m.result,
        }
      })
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

      setQcMode(false); setQcGearbox(null); setQcPlan(null)
      setMeasurements({}); setQcComments('')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

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
          <h1 className="text-2xl font-bold">Final Kalite Kontrol</h1>
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
                            {item.sample_info
                              ? <><span className="font-semibold">{item.sample_info}</span> <span className="text-xs text-muted-foreground">(yazı eşleşmesi)</span></>
                              : <>
                                  {item.nominal_value !== null && item.nominal_value !== undefined ? `${item.nominal_value} ` : ''}
                                  {item.lower_limit !== null && item.lower_limit !== undefined && item.upper_limit !== null && item.upper_limit !== undefined
                                    ? `(${item.lower_limit} - ${item.upper_limit})` : item.upper_limit !== null && item.upper_limit !== undefined ? `Max ${item.upper_limit}` : ''}
                                  {' '}{item.unit}
                                </>
                            }
                          </TableCell>
                          <TableCell>
                            <Input type={item.sample_info ? 'text' : 'number'} step={item.sample_info ? undefined : '0.001'}
                              className={`font-mono ${item.sample_info ? 'text-left' : 'text-right'} ${m?.result === 'ret' ? 'border-red-300 text-red-600 font-bold' : ''}`}
                              placeholder={item.sample_info || '---'} value={m?.measured_value || ''} onChange={e => handleValueChange(item.id, e.target.value)} />
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
              <CardContent><Textarea value={qcComments} onChange={e => setQcComments(e.target.value)} placeholder="Kontrol notları..." rows={3} /></CardContent>
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
          <h1 className="text-2xl font-bold">Final Kalite Kontrol</h1>
          <p className="text-sm text-muted-foreground mt-1">Şanzıman kalite kontrolü ve geçmiş kayıtları</p>
        </div>
        <Link href="/kontrol-plani">
          <Button variant="outline"><ClipboardList className="w-4 h-4 mr-2" />Kontrol Planları</Button>
        </Link>
      </div>

      <Tabs defaultValue="kontrol">
        <TabsList>
          <TabsTrigger value="kontrol"><ShieldCheck className="w-4 h-4 mr-1" />Final Kalite Kontrol</TabsTrigger>
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

        {/* GEÇMİŞ KAYITLAR SEKMESİ */}
        <TabsContent value="gecmis">
          <div className="flex justify-end mb-4">
            <DateRangeFilter start={dateRangeStart} end={dateRangeEnd} label="Kontrol Tarihi" />
          </div>
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
