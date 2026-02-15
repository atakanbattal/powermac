'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STATUS_LABELS, STATUS_COLORS, ALLOWED_TRANSITIONS, MODEL_LABELS } from '@/lib/constants'
import type { Gearbox, GearboxPartMapping, QualityInspection, Shipment, VehicleAssembly, NcrRecord, Attachment, AuditLog, GearboxStatus } from '@/lib/types'
import { ArrowLeft, Calendar, User, FileText, Package, ShieldCheck, Truck, Car, AlertTriangle, History, Paperclip, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { toast } from 'sonner'
import Link from 'next/link'

interface DetailProps {
  gearbox: Gearbox & { responsible_user?: { full_name: string } | null; bom_revision?: { id: string; model: string; revision_no: number } | null }
  partMappings: (GearboxPartMapping & { material?: { code: string; name: string; unit: string; category: string } | null; stock_entry?: { invoice_number: string; lot_number: string; supplier?: { name: string } | null } | null })[]
  inspections: (QualityInspection & { inspector?: { full_name: string } | null; control_plan?: { model: string; revision_no: number } | null; quality_measurements?: { measured_value: number | null; result: string; control_plan_item?: { name: string; nominal_value: number | null; lower_limit: number | null; upper_limit: number | null; unit: string; is_critical: boolean } | null }[] })[]
  shipments: Shipment[]
  assemblies: VehicleAssembly[]
  ncrs: (NcrRecord & { responsible_user?: { full_name: string } | null })[]
  attachments: Attachment[]
  auditLogs: (AuditLog & { user?: { full_name: string } | null })[]
}

const RESULT_ICON = {
  ok: <CheckCircle className="w-4 h-4 text-emerald-600" />,
  ret: <XCircle className="w-4 h-4 text-red-600" />,
  beklemede: <Clock className="w-4 h-4 text-amber-500" />,
}

export function GearboxDetailClient({ gearbox, partMappings, inspections, shipments, assemblies, ncrs, attachments, auditLogs }: DetailProps) {
  const [status, setStatus] = useState(gearbox.status)
  const router = useRouter()
  const supabase = createClient()
  const allowedTransitions = ALLOWED_TRANSITIONS[status] || []

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase
      .from('gearboxes')
      .update({ status: newStatus, ...(newStatus === 'stokta' ? { production_end: new Date().toISOString() } : {}) })
      .eq('id', gearbox.id)
    if (error) {
      toast.error(error.message)
    } else {
      setStatus(newStatus as GearboxStatus)
      toast.success(`Durum güncellendi: ${STATUS_LABELS[newStatus as GearboxStatus]}`)
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/uretim" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Üretim Listesi
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{gearbox.serial_number}</h1>
            <Badge className={STATUS_COLORS[status]} variant="outline">{STATUS_LABELS[status]}</Badge>
            <Badge variant="outline">{MODEL_LABELS[gearbox.model]}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {allowedTransitions.length > 0 && (
            <Select onValueChange={handleStatusChange}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Durum Değiştir" />
              </SelectTrigger>
              <SelectContent>
                {allowedTransitions.map(s => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Link href={`/kalite-kontrol/yeni?gearbox=${gearbox.id}`}>
            <Button variant="outline"><ShieldCheck className="w-4 h-4 mr-2" />Final Kontrol</Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Calendar className="w-3.5 h-3.5" />Üretim Tarihi</div>
            <p className="font-bold">{new Date(gearbox.production_date).toLocaleDateString('tr-TR')}</p>
            {gearbox.production_end && <p className="text-xs text-muted-foreground mt-1">Bitiş: {new Date(gearbox.production_end).toLocaleDateString('tr-TR')}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><User className="w-3.5 h-3.5" />Sorumlu</div>
            <p className="font-bold">{gearbox.responsible_user?.full_name || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">İş Emri</div>
            <p className="font-bold">{gearbox.work_order || '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="w-3.5 h-3.5" />BOM Revizyon</div>
            <p className="font-bold">{gearbox.bom_revision ? `Rev ${gearbox.bom_revision.revision_no}` : 'Atanmadı'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Package className="w-3.5 h-3.5" />Parça Eşleştirme</div>
            <p className="font-bold">{gearbox.parts_mapping_complete ? 'Tamamlandı' : 'Bekliyor'}</p>
            <p className="text-xs text-muted-foreground">{partMappings.length} parça eşleştirildi</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="parts">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="parts"><Package className="w-4 h-4 mr-1" />Parçalar</TabsTrigger>
          <TabsTrigger value="qc"><ShieldCheck className="w-4 h-4 mr-1" />Kalite</TabsTrigger>
          <TabsTrigger value="shipment"><Truck className="w-4 h-4 mr-1" />Sevk/Montaj</TabsTrigger>
          <TabsTrigger value="ncr"><AlertTriangle className="w-4 h-4 mr-1" />NCR</TabsTrigger>
          <TabsTrigger value="files"><Paperclip className="w-4 h-4 mr-1" />Ekler</TabsTrigger>
          <TabsTrigger value="timeline"><History className="w-4 h-4 mr-1" />Timeline</TabsTrigger>
        </TabsList>

        {/* Parts Tab */}
        <TabsContent value="parts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Eşleştirilen Parçalar</CardTitle>
              <Link href={`/eslestirme/${gearbox.id}`}>
                <Button size="sm"><Package className="w-4 h-4 mr-1" />Parça Eşleştir</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parça Kodu</TableHead>
                    <TableHead>Parça Adı</TableHead>
                    <TableHead>İrsaliye / Lot</TableHead>
                    <TableHead>Tedarikçi</TableHead>
                    <TableHead className="text-right">Miktar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partMappings.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Henüz parça eşleştirilmedi</TableCell></TableRow>
                  ) : partMappings.map(pm => (
                    <TableRow key={pm.id}>
                      <TableCell className="font-mono">{pm.material?.code}</TableCell>
                      <TableCell className="font-medium">{pm.material?.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{pm.stock_entry?.invoice_number || '-'}</span>
                        {pm.stock_entry?.lot_number && <span className="text-xs text-muted-foreground ml-2">Lot: {pm.stock_entry.lot_number}</span>}
                      </TableCell>
                      <TableCell>{pm.stock_entry?.supplier?.name || '-'}</TableCell>
                      <TableCell className="text-right font-bold">{pm.quantity} {pm.material?.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QC Tab */}
        <TabsContent value="qc">
          <Card>
            <CardHeader><CardTitle>Kalite Kontrol Sonuçları</CardTitle></CardHeader>
            <CardContent>
              {inspections.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Henüz kalite kontrol yapılmadı</p>
              ) : inspections.map(insp => (
                <div key={insp.id} className="mb-6 last:mb-0">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b">
                    <div className="flex items-center gap-3">
                      {RESULT_ICON[insp.overall_result]}
                      <div>
                        <p className="font-medium">Kontrol Planı Rev {insp.control_plan?.revision_no}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(insp.inspection_date).toLocaleDateString('tr-TR')} &bull; {insp.inspector?.full_name}
                        </p>
                      </div>
                    </div>
                    <Badge className={insp.overall_result === 'ok' ? 'bg-emerald-100 text-emerald-700' : insp.overall_result === 'ret' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} variant="outline">
                      {insp.overall_result === 'ok' ? 'GEÇTİ' : insp.overall_result === 'ret' ? 'RED' : 'BEKLİYOR'}
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>Ölçüm</TableHead>
                        <TableHead>Nominal</TableHead>
                        <TableHead>Tolerans</TableHead>
                        <TableHead>Gerçek Değer</TableHead>
                        <TableHead className="text-right">Sonuç</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insp.quality_measurements?.map(m => (
                        <TableRow key={m.id} className={m.result === 'ret' ? 'bg-red-50' : ''}>
                          <TableCell>{m.control_plan_item?.is_critical && <span className="text-amber-500" title="Kritik">★</span>}</TableCell>
                          <TableCell className="font-medium">{m.control_plan_item?.name}</TableCell>
                          <TableCell className="font-mono text-sm">{m.control_plan_item?.nominal_value} {m.control_plan_item?.unit}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {m.control_plan_item?.lower_limit} - {m.control_plan_item?.upper_limit}
                          </TableCell>
                          <TableCell className={`font-mono font-bold ${m.result === 'ret' ? 'text-red-600' : ''}`}>
                            {m.measured_value ?? '-'} {m.control_plan_item?.unit}
                          </TableCell>
                          <TableCell className="text-right">{RESULT_ICON[m.result]}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shipment/Assembly Tab */}
        <TabsContent value="shipment">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5" />Sevkiyat</CardTitle></CardHeader>
              <CardContent>
                {shipments.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Henüz sevkiyat yok</p>
                ) : shipments.map(s => (
                  <div key={s.id} className="p-4 border rounded-lg mb-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Tarih:</span> <strong>{new Date(s.shipment_date).toLocaleDateString('tr-TR')}</strong></div>
                      <div><span className="text-muted-foreground">Müşteri:</span> <strong>{s.customer_name || '-'}</strong></div>
                      <div><span className="text-muted-foreground">İrsaliye No:</span> <strong className="font-mono">{s.waybill_number || '-'}</strong></div>
                      <div><span className="text-muted-foreground">Fatura No:</span> <strong className="font-mono">{s.invoice_number || '-'}</strong></div>
                    </div>
                    {s.notes && <p className="text-sm text-muted-foreground mt-2">{s.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Car className="w-5 h-5" />Araç Montaj</CardTitle></CardHeader>
              <CardContent>
                {assemblies.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Montaj bilgisi girilmedi</p>
                ) : assemblies.map(a => (
                  <div key={a.id} className="p-4 border rounded-lg mb-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Montaj Tarihi:</span> <strong>{a.assembly_date ? new Date(a.assembly_date).toLocaleDateString('tr-TR') : '-'}</strong></div>
                      <div><span className="text-muted-foreground">Müşteri:</span> <strong>{a.customer_name || '-'}</strong></div>
                      <div><span className="text-muted-foreground">Plaka:</span> <strong className="font-mono">{a.vehicle_plate || '-'}</strong></div>
                      <div><span className="text-muted-foreground">VIN/Şase:</span> <strong className="font-mono">{a.vin_number || '-'}</strong></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* NCR Tab */}
        <TabsContent value="ncr">
          <Card>
            <CardHeader><CardTitle>Uygunsuzluk Kayıtları (NCR)</CardTitle></CardHeader>
            <CardContent>
              {ncrs.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Uygunsuzluk kaydı yok</p>
              ) : ncrs.map(n => (
                <div key={n.id} className="p-4 border rounded-lg mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold">{n.ncr_number}</span>
                    <Badge variant="outline">{n.status}</Badge>
                  </div>
                  <p className="text-sm">{n.description}</p>
                  {n.root_cause && <p className="text-sm mt-2"><strong>Kök Neden:</strong> {n.root_cause}</p>}
                  {n.corrective_action && <p className="text-sm mt-1"><strong>Aksiyon:</strong> {n.corrective_action}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <Card>
            <CardHeader><CardTitle>Dosya Ekleri</CardTitle></CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Henüz dosya eklenmedi</p>
              ) : attachments.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg mb-2">
                  <div className="flex items-center gap-3">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{a.file_name}</p>
                      <p className="text-xs text-muted-foreground">{a.file_size ? `${(a.file_size / 1024).toFixed(1)} KB` : ''}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader><CardTitle>Audit Trail / Zaman Çizelgesi</CardTitle></CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Kayıt yok</p>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-3 before:w-0.5 before:bg-muted">
                  {auditLogs.map(log => (
                    <div key={log.id} className="relative pl-10">
                      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-xs ${
                        log.action === 'INSERT' ? 'bg-emerald-500' : log.action === 'UPDATE' ? 'bg-blue-500' : 'bg-red-500'
                      }`}>
                        {log.action === 'INSERT' ? '+' : log.action === 'UPDATE' ? '~' : '-'}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {log.entity_type} - {log.action === 'INSERT' ? 'Oluşturuldu' : log.action === 'UPDATE' ? 'Güncellendi' : 'Silindi'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {log.user?.full_name || 'Sistem'} &bull;{' '}
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: tr })}
                        </p>
                        {log.action === 'UPDATE' && log.new_values && (
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto max-h-20">
                            {JSON.stringify(log.new_values, null, 2).slice(0, 200)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
