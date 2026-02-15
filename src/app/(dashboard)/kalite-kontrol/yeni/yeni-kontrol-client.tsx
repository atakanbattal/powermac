'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { MODEL_LABELS } from '@/lib/constants'
import type { Gearbox, ControlPlanRevision, ControlPlanItem, InspectionResult } from '@/lib/types'
import { ArrowLeft, ShieldCheck, Star, CheckCircle, XCircle, Clock, Loader2, AlertTriangle, Send, Save } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Props {
  gearbox: Gearbox
  controlPlan: (ControlPlanRevision & { control_plan_items: ControlPlanItem[] }) | null
}

interface MeasurementEntry {
  control_plan_item_id: string
  measured_value: string
  result: InspectionResult
}

function evaluateMeasurement(value: number | null, item: ControlPlanItem): InspectionResult {
  if (value === null || isNaN(value)) return 'beklemede'
  const lower = item.lower_limit
  const upper = item.upper_limit
  if (lower !== null && lower !== undefined && value < lower) return 'ret'
  if (upper !== null && upper !== undefined && value > upper) return 'ret'
  return 'ok'
}

const RESULT_ICON = {
  ok: <CheckCircle className="w-5 h-5 text-emerald-600" />,
  ret: <XCircle className="w-5 h-5 text-red-600" />,
  beklemede: <Clock className="w-5 h-5 text-amber-500" />,
}

export function YeniKontrolClient({ gearbox, controlPlan }: Props) {
  const items = controlPlan?.control_plan_items || []
  const [measurements, setMeasurements] = useState<Record<string, MeasurementEntry>>(
    Object.fromEntries(items.map(item => [item.id, { control_plan_item_id: item.id, measured_value: '', result: 'beklemede' }]))
  )
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleValueChange = useCallback((itemId: string, value: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    const numVal = value ? parseFloat(value) : null
    const result = evaluateMeasurement(numVal, item)
    setMeasurements(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], measured_value: value, result },
    }))
  }, [items])

  // Genel sonuç hesapla
  const overallResult = (): InspectionResult => {
    const vals = Object.values(measurements)
    if (vals.some(m => m.result === 'beklemede')) return 'beklemede'
    // Kritik ölçümde RET varsa otomatik RET
    const hasCriticalRet = vals.some(m => {
      const item = items.find(i => i.id === m.control_plan_item_id)
      return item?.is_critical && m.result === 'ret'
    })
    if (hasCriticalRet) return 'ret'
    if (vals.some(m => m.result === 'ret')) return 'ret'
    return 'ok'
  }

  const result = overallResult()
  const allFilled = Object.values(measurements).every(m => m.measured_value !== '')

  const handleSubmit = async (isDraft: boolean) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const finalResult = isDraft ? 'beklemede' : result

      // 1. İnspeksiyon kaydı oluştur
      const { data: inspection, error } = await supabase.from('quality_inspections').insert({
        gearbox_id: gearbox.id,
        control_plan_id: controlPlan!.id,
        inspector_id: user?.id,
        overall_result: finalResult,
        comments,
        is_draft: isDraft,
      }).select().single()
      if (error) throw error

      // 2. Ölçüm değerlerini kaydet
      const measurementRows = Object.values(measurements).map(m => ({
        inspection_id: inspection.id,
        control_plan_item_id: m.control_plan_item_id,
        measured_value: m.measured_value ? parseFloat(m.measured_value) : null,
        result: m.result,
      }))
      const { error: mError } = await supabase.from('quality_measurements').insert(measurementRows)
      if (mError) throw mError

      // 3. Eğer taslak değilse şanzıman durumunu güncelle
      if (!isDraft) {
        const newStatus = finalResult === 'ok' ? 'stokta' : 'revizyon_iade'
        await supabase.from('gearboxes').update({
          status: newStatus,
          ...(newStatus === 'stokta' ? { production_end: new Date().toISOString() } : {}),
        }).eq('id', gearbox.id)

        // RET ise NCR oluştur
        if (finalResult === 'ret') {
          const ncrNum = await supabase.rpc('generate_ncr_number')
          await supabase.from('ncr_records').insert({
            gearbox_id: gearbox.id,
            inspection_id: inspection.id,
            ncr_number: ncrNum.data || `NCR-${Date.now()}`,
            status: 'acik',
            description: `Final kontrol RED - ${gearbox.serial_number}. ${comments}`,
            created_by: user?.id,
          })
          toast.warning('RED - Uygunsuzluk kaydı (NCR) otomatik oluşturuldu')
        } else {
          toast.success('Final kontrol GEÇTİ - Şanzıman stoğa alındı')
        }
      } else {
        toast.success('Taslak kaydedildi')
      }

      router.push('/kalite-kontrol')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata oluştu')
    } finally { setLoading(false) }
  }

  if (!controlPlan) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
        <h2 className="text-lg font-bold">Kontrol Planı Bulunamadı</h2>
        <p className="text-muted-foreground mt-2">{MODEL_LABELS[gearbox.model]} için aktif kontrol planı tanımlı değil.</p>
        <Link href="/kontrol-plani"><Button className="mt-4">Kontrol Planı Oluştur</Button></Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/kalite-kontrol" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> Kalite Kontrol
        </Link>
        <h1 className="text-2xl font-bold">Final Kalite Kontrol</h1>
        <div className="flex items-center gap-4 mt-2">
          <Badge variant="outline" className="font-mono text-base px-3 py-1">{gearbox.serial_number}</Badge>
          <Badge variant="outline">{MODEL_LABELS[gearbox.model]}</Badge>
          <Badge variant="secondary">Kontrol Planı Rev {controlPlan.revision_no}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Ölçüm Girişi</CardTitle>
            </CardHeader>
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
                            type="number"
                            step="0.001"
                            className={`font-mono text-right ${m?.result === 'ret' ? 'border-red-300 text-red-600 font-bold' : ''}`}
                            placeholder="---"
                            value={m?.measured_value || ''}
                            onChange={e => handleValueChange(item.id, e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {RESULT_ICON[m?.result || 'beklemede']}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Genel Sonuç */}
          <Card>
            <CardHeader><CardTitle>Kontrol Sonucu</CardTitle></CardHeader>
            <CardContent>
              <div className={`flex items-center justify-between p-4 rounded-lg border ${
                result === 'ok' ? 'bg-emerald-50 border-emerald-200' :
                result === 'ret' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-3">
                  {result === 'ok' ? <CheckCircle className="w-8 h-8 text-emerald-600" /> :
                   result === 'ret' ? <XCircle className="w-8 h-8 text-red-600" /> :
                   <Clock className="w-8 h-8 text-amber-500" />}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">GENEL SONUÇ</div>
                    <div className={`text-xl font-bold ${
                      result === 'ok' ? 'text-emerald-700' : result === 'ret' ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      {result === 'ok' ? 'GEÇTİ' : result === 'ret' ? 'RED' : 'BEKLİYOR'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Toplam Ölçüm</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-600">Geçen</span>
                  <span className="font-medium">{Object.values(measurements).filter(m => m.result === 'ok').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600">Red</span>
                  <span className="font-medium">{Object.values(measurements).filter(m => m.result === 'ret').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-600">Bekleyen</span>
                  <span className="font-medium">{Object.values(measurements).filter(m => m.result === 'beklemede').length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Teknisyen Yorumu</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                placeholder="Kontrol ile ilgili notlar..."
                rows={4}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm sticky bottom-0">
        <p className="text-sm text-muted-foreground">
          {!allFilled && 'Tüm ölçümler doldurulmadan kayıt tamamlanamaz.'}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSubmit(true)} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Taslak Kaydet
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={loading || !allFilled}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Kontrol Kaydını Onayla
          </Button>
        </div>
      </div>
    </div>
  )
}
