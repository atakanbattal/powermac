'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABELS, STATUS_COLORS, MODEL_LABELS } from '@/lib/constants'
import type { GearboxStatus, GearboxModel } from '@/lib/types'
import { Search, Eye, ArrowLeft, Package, CheckCircle, XCircle, Clock, Star, Truck, Wrench, FileText, Car, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

interface GearboxSummary {
  id: string
  serial_number: string
  model: string
  status: string
  production_date: string
  production_start?: string
  production_end?: string
  shipments?: { shipment_date: string }[]
  vehicle_assemblies?: { vehicle_plate?: string; vin_number?: string }[]
}

interface QuarantineInfo {
  id: string
  reason: string
  status: string
  quarantined_at: string
}

interface DetailData {
  id: string
  serial_number: string
  model: string
  status: string
  production_date: string
  production_start?: string
  production_end?: string
  work_order?: string
  notes?: string
  responsible_user?: { full_name: string } | { full_name: string }[] | null
  gearbox_part_mappings?: {
    id: string; quantity: number; mapped_at: string
    material?: { code: string; name: string; unit: string } | null
    stock_entry?: {
      invoice_number?: string; lot_number?: string; quarantine_id?: string | null
      supplier?: { name: string } | null
    } | null
  }[]
  quality_inspections?: {
    id: string; overall_result: string; inspection_date: string; is_draft: boolean; comments?: string
    inspector?: { full_name: string } | null
    quality_measurements?: {
      id: string; measured_value?: number; result: string
      control_plan_item?: { name: string; nominal_value?: number; lower_limit?: number; upper_limit?: number; unit: string; is_critical: boolean } | null
    }[]
  }[]
  shipments?: { id: string; shipment_date: string; customer_name?: string; waybill_number?: string; invoice_number?: string }[]
  vehicle_assemblies?: { id: string; assembly_date?: string; vehicle_plate?: string; vin_number?: string; customer_name?: string }[]
}

interface Props {
  gearboxes: GearboxSummary[]
  query: string
  searchResults: { type: string; [key: string]: unknown }[]
  detail: DetailData | null
  quarantineMap: Record<string, QuarantineInfo>
}

const RESULT_ICON: Record<string, React.ReactNode> = {
  ok: <CheckCircle className="w-4 h-4 text-emerald-600" />,
  ret: <XCircle className="w-4 h-4 text-red-600" />,
  beklemede: <Clock className="w-4 h-4 text-amber-500" />,
}

export function IzlenebilirlikClient({ gearboxes, query: initQuery, searchResults, detail, quarantineMap }: Props) {
  const [search, setSearch] = useState(initQuery)
  const [mountFormOpen, setMountFormOpen] = useState(false)
  const [mountForm, setMountForm] = useState({
    vehicle_plate: '',
    vin_number: '',
    customer_name: '',
    assembly_date: new Date().toISOString().split('T')[0],
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      router.push(`/izlenebilirlik?q=${encodeURIComponent(search.trim())}`)
    }
  }

  const openMountForm = () => {
    setMountForm({
      vehicle_plate: '',
      vin_number: '',
      customer_name: detail?.shipments?.[0]?.customer_name || '',
      assembly_date: new Date().toISOString().split('T')[0],
    })
    setMountFormOpen(true)
  }

  const handleCreateAssembly = async () => {
    if (!detail?.id) return
    if (!mountForm.vehicle_plate?.trim() || !mountForm.vin_number?.trim()) {
      toast.error('Plaka ve VIN/Şase numarası zorunludur')
      return
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('vehicle_assemblies').insert({
        gearbox_id: detail.id,
        vehicle_plate: mountForm.vehicle_plate.trim(),
        vin_number: mountForm.vin_number.trim(),
        customer_name: mountForm.customer_name?.trim() || null,
        assembly_date: mountForm.assembly_date || null,
        recorded_by: user?.id,
      })
      await supabase.from('gearboxes').update({ status: 'montajlandi' }).eq('id', detail.id)
      toast.success('Araç montaj bilgisi kaydedildi')
      setMountFormOpen(false)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally {
      setLoading(false)
    }
  }

  // === DETAY GÖRÜNÜMÜ ===
  if (detail) {
    const mappings = detail.gearbox_part_mappings || []
    const inspections = detail.quality_inspections || []
    const shipments = detail.shipments || []
    const assemblies = detail.vehicle_assemblies || []

    return (
      <div className="space-y-6">
        <div>
          <button onClick={() => router.push('/izlenebilirlik')} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Geri
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold font-mono">{detail.serial_number}</h1>
            <Badge variant="outline">{MODEL_LABELS[detail.model as GearboxModel]}</Badge>
            <Badge className={STATUS_COLORS[detail.status as GearboxStatus]} variant="outline">{STATUS_LABELS[detail.status as GearboxStatus]}</Badge>
          </div>
        </div>

        {/* Genel Bilgiler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Üretim Tarihi</p>
            <p className="font-medium">{new Date(detail.production_date).toLocaleDateString('tr-TR')}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Sorumlu</p>
            <p className="font-medium">{(Array.isArray(detail.responsible_user) ? detail.responsible_user[0]?.full_name : detail.responsible_user?.full_name) || '-'}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">İş Emri</p>
            <p className="font-medium">{detail.work_order || '-'}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Üretim Bitiş</p>
            <p className="font-medium">{detail.production_end ? new Date(detail.production_end).toLocaleDateString('tr-TR') : '-'}</p>
          </CardContent></Card>
        </div>

        {/* Kullanılan Parçalar */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="w-5 h-5" />Kullanılan Parçalar ({mappings.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Malzeme Kodu</TableHead>
                  <TableHead>Adı</TableHead>
                  <TableHead className="text-right">Miktar</TableHead>
                  <TableHead>İrsaliye</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Tedarikçi</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Parça eşleştirmesi yok</TableCell></TableRow>
                ) : mappings.map(m => {
                  const fromQuarantine = !!m.stock_entry?.quarantine_id
                  return (
                    <TableRow key={m.id} className={fromQuarantine ? 'bg-amber-50/50' : ''}>
                      <TableCell className="font-mono">{m.material?.code}</TableCell>
                      <TableCell className="font-medium">{m.material?.name}</TableCell>
                      <TableCell className="text-right font-bold">{m.quantity} {m.material?.unit}</TableCell>
                      <TableCell className="font-mono text-sm">{m.stock_entry?.invoice_number || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{m.stock_entry?.lot_number || '-'}</TableCell>
                      <TableCell className="text-sm">{m.stock_entry?.supplier?.name || '-'}</TableCell>
                      <TableCell>
                        {fromQuarantine ? (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                            <AlertTriangle className="w-3 h-3 mr-1 inline" />Karantina
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Normal</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Karantina Geçmişi Uyarısı */}
        {mappings.some(m => !!m.stock_entry?.quarantine_id) && (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                <ShieldAlert className="w-5 h-5" />Karantina Geçmişi
              </CardTitle>
              <p className="text-sm text-amber-700 font-normal mt-1">
                Bu şanzımanda karantina geçmişi olan parçalar kullanılmıştır. İleride sorun yaşanırsa bu tedarikçiden tekrar malzeme almayı değerlendirin.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {mappings.filter(m => !!m.stock_entry?.quarantine_id).map(m => {
                  const qInfo = m.stock_entry?.quarantine_id ? quarantineMap[m.stock_entry.quarantine_id] : null
                  return (
                    <div key={m.id} className="flex items-center gap-4 p-3 rounded-lg bg-white border border-amber-200">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{m.material?.code} - {m.material?.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          İrs: {m.stock_entry?.invoice_number || '-'} · Lot: {m.stock_entry?.lot_number || '-'}
                          {qInfo?.reason && <> · <span className="text-red-600 font-medium">Red nedeni: {qInfo.reason}</span></>}
                        </p>
                      </div>
                      <Badge variant="destructive" className="shrink-0">Karantinadan Kullanıldı</Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Kalite Kontrol Sonuçları */}
        {inspections.map(insp => (
          <Card key={insp.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {RESULT_ICON[insp.overall_result]}
                Kalite Kontrol - {new Date(insp.inspection_date).toLocaleDateString('tr-TR')}
                <Badge className={insp.overall_result === 'ok' ? 'bg-emerald-100 text-emerald-700' : insp.overall_result === 'ret' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} variant="outline">
                  {insp.overall_result === 'ok' ? 'GEÇTİ' : insp.overall_result === 'ret' ? 'RED' : 'BEKLİYOR'}
                </Badge>
                {insp.inspector && <span className="text-xs text-muted-foreground font-normal">- {insp.inspector.full_name}</span>}
              </CardTitle>
            </CardHeader>
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
                  {(insp.quality_measurements || []).map(qm => (
                    <TableRow key={qm.id} className={qm.result === 'ret' ? 'bg-red-50' : ''}>
                      <TableCell>{qm.control_plan_item?.is_critical && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}</TableCell>
                      <TableCell className="font-medium">{qm.control_plan_item?.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {qm.control_plan_item?.nominal_value !== null ? `${qm.control_plan_item?.nominal_value} ` : ''}
                        {qm.control_plan_item?.lower_limit !== null && qm.control_plan_item?.upper_limit !== null
                          ? `(${qm.control_plan_item?.lower_limit} - ${qm.control_plan_item?.upper_limit})`
                          : ''} {qm.control_plan_item?.unit}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${qm.result === 'ret' ? 'text-red-600' : ''}`}>
                        {qm.measured_value ?? '-'}
                      </TableCell>
                      <TableCell className="text-center">{RESULT_ICON[qm.result]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {insp.comments && (
                <div className="p-4 border-t text-sm text-muted-foreground">
                  <strong>Yorum:</strong> {insp.comments}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Sevkiyat */}
        {shipments.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Truck className="w-5 h-5" />Sevkiyat</CardTitle></CardHeader>
            <CardContent>
              {shipments.map(s => (
                <div key={s.id} className="flex items-center gap-6 py-2 border-b last:border-0">
                  <div><span className="text-xs text-muted-foreground">Tarih</span><p className="font-medium">{new Date(s.shipment_date).toLocaleDateString('tr-TR')}</p></div>
                  <div><span className="text-xs text-muted-foreground">Müşteri</span><p className="font-medium">{s.customer_name || '-'}</p></div>
                  <div><span className="text-xs text-muted-foreground">İrsaliye</span><p className="font-mono">{s.waybill_number || '-'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Fatura</span><p className="font-mono">{s.invoice_number || '-'}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Montaj - Müşteri bildirimi (son adım) */}
        {shipments.length > 0 && assemblies.length === 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="w-5 h-5" />
                Son Adım: Araç Montaj Bildirimi
              </CardTitle>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Müşteri şanzımanı hangi plakalı, hangi VIN/şase numaralı araca taktığını bildirdiğinde bu bilgiyi kaydedin.
              </p>
            </CardHeader>
            <CardContent>
              <Button onClick={openMountForm}>
                <Car className="w-4 h-4 mr-2" />Araç Montaj Bilgisi Ekle
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Montaj - Kayıtlı bilgiler */}
        {assemblies.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wrench className="w-5 h-5" />Araç Montaj</CardTitle></CardHeader>
            <CardContent>
              {assemblies.map(a => (
                <div key={a.id} className="flex items-center gap-6 py-2 border-b last:border-0">
                  <div><span className="text-xs text-muted-foreground">Tarih</span><p className="font-medium">{a.assembly_date ? new Date(a.assembly_date).toLocaleDateString('tr-TR') : '-'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Plaka</span><p className="font-mono font-bold">{a.vehicle_plate || '-'}</p></div>
                  <div><span className="text-xs text-muted-foreground">VIN / Şase</span><p className="font-mono">{a.vin_number || '-'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Müşteri</span><p className="font-medium">{a.customer_name || '-'}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Araç Montaj Bilgisi Ekleme Dialog */}
        <Dialog open={mountFormOpen} onOpenChange={setMountFormOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Müşteri Araç Montaj Bildirimi</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Müşteri şanzımanı hangi araca taktığını bildirdi. Plaka ve VIN/şase numarasını girin.
            </p>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Araç Plakası *</Label>
                  <Input
                    value={mountForm.vehicle_plate}
                    onChange={e => setMountForm({ ...mountForm, vehicle_plate: e.target.value })}
                    placeholder="34 ABC 123"
                  />
                </div>
                <div className="space-y-2">
                  <Label>VIN / Şase No *</Label>
                  <Input
                    value={mountForm.vin_number}
                    onChange={e => setMountForm({ ...mountForm, vin_number: e.target.value })}
                    placeholder="Araç seri numarası"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Montaj Tarihi</Label>
                  <Input
                    type="date"
                    value={mountForm.assembly_date}
                    onChange={e => setMountForm({ ...mountForm, assembly_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Müşteri</Label>
                  <Input
                    value={mountForm.customer_name}
                    onChange={e => setMountForm({ ...mountForm, customer_name: e.target.value })}
                    placeholder="Sevkiyat müşterisi"
                  />
                </div>
              </div>
              <Button onClick={handleCreateAssembly} disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Car className="w-4 h-4 mr-2" />}
                Montaj Bilgisini Kaydet
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {detail.notes && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-5 h-5" />Notlar</CardTitle></CardHeader>
            <CardContent><p className="text-sm">{detail.notes}</p></CardContent>
          </Card>
        )}
      </div>
    )
  }

  // === ANA LİSTE GÖRÜNÜMÜ ===
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">İzlenebilirlik</h1>
        <p className="text-sm text-muted-foreground mt-1">Tüm üretilen şanzımanlar ve tam detay görünümü</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                className="pl-11 h-12 text-lg"
                placeholder="Seri no, VIN, plaka ile ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg"><Search className="w-5 h-5 mr-2" />Ara</Button>
          </form>
        </CardContent>
      </Card>

      {/* Arama sonuçları */}
      {initQuery && searchResults.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">&quot;{initQuery}&quot; için {searchResults.length} sonuç</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {searchResults.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono font-medium">{(r as { serial_number?: string }).serial_number || '-'}</TableCell>
                    <TableCell><Badge variant="outline">{MODEL_LABELS[(r as { model?: string }).model as GearboxModel] || '-'}</Badge></TableCell>
                    <TableCell><Badge className={STATUS_COLORS[(r as { status?: string }).status as GearboxStatus]} variant="outline">{STATUS_LABELS[(r as { status?: string }).status as GearboxStatus] || '-'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Link href={`/izlenebilirlik?id=${(r as { id?: string }).id || (r as { gearbox_id?: string }).gearbox_id}`}>
                        <Button variant="ghost" size="sm"><Eye className="w-4 h-4 mr-1" />Detay</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tüm Şanzımanlar Tablosu */}
      <Card>
        <CardHeader><CardTitle>Tüm Üretimler</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seri No</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Üretim Tarihi</TableHead>
                <TableHead>Sevk Tarihi</TableHead>
                <TableHead>Takıldığı Araç</TableHead>
                <TableHead>Montaj Bilgisi</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gearboxes.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Henüz üretim yok</TableCell></TableRow>
              ) : gearboxes.map(g => {
                const shipmentDate = Array.isArray(g.shipments) && g.shipments.length > 0 ? g.shipments[0].shipment_date : null
                const hasAssembly = Array.isArray(g.vehicle_assemblies) && g.vehicle_assemblies.length > 0
                const vehicleInfo = hasAssembly ? g.vehicle_assemblies?.[0] : null
                const araçText = vehicleInfo
                  ? [vehicleInfo.vehicle_plate, vehicleInfo.vin_number].filter(Boolean).join(' · ')
                  : '-'
                const isShipped = g.status === 'sevk_edildi' || g.status === 'montajlandi'
                const montajStatus = !isShipped ? null : hasAssembly ? 'eklendi' : 'eksik'
                return (
                  <TableRow key={g.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => router.push(`/izlenebilirlik?id=${g.id}`)}>
                    <TableCell className="font-mono font-bold">{g.serial_number}</TableCell>
                    <TableCell><Badge variant="outline">{MODEL_LABELS[g.model as GearboxModel]}</Badge></TableCell>
                    <TableCell><Badge className={STATUS_COLORS[g.status as GearboxStatus]} variant="outline">{STATUS_LABELS[g.status as GearboxStatus]}</Badge></TableCell>
                    <TableCell>{new Date(g.production_date).toLocaleDateString('tr-TR')}</TableCell>
                    <TableCell>{shipmentDate ? new Date(shipmentDate).toLocaleDateString('tr-TR') : '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{araçText}</TableCell>
                    <TableCell>
                      {montajStatus === 'eklendi' && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle className="w-3 h-3 mr-1 inline" />Eklendi
                        </Badge>
                      )}
                      {montajStatus === 'eksik' && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <Car className="w-3 h-3 mr-1 inline" />Eksik
                        </Badge>
                      )}
                      {montajStatus === null && <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm"><Eye className="w-4 h-4 mr-1" />Detay</Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
