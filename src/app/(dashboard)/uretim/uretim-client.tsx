'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import type { Gearbox, GearboxModel, GearboxStatus } from '@/lib/types'
import type { Profile } from '@/lib/types'
import { Plus, Factory, Search, Loader2, Eye, FileText, User, CheckCircle, Truck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface GearboxModelRow {
  id: string
  code: string
  name: string
}

interface UretimClientProps {
  gearboxes: (Gearbox & { responsible_user?: { full_name: string } | null })[]
  profiles: Pick<Profile, 'id' | 'full_name' | 'role'>[]
  gearboxModels: GearboxModelRow[]
}

export function UretimClient({ gearboxes: initialGearboxes, profiles, gearboxModels }: UretimClientProps) {
  const [gearboxes, setGearboxes] = useState(initialGearboxes)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModel, setFilterModel] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Form state
  const [prodDate, setProdDate] = useState(new Date().toISOString().split('T')[0])
  const [model, setModel] = useState<string>(gearboxModels[0]?.code ?? 'A')
  const [responsibleId, setResponsibleId] = useState<string>('')
  const [workOrder, setWorkOrder] = useState('')
  const [notes, setNotes] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [activeBom, setActiveBom] = useState<{ id: string; item_count: number } | null>(null)
  const [shortageModalOpen, setShortageModalOpen] = useState(false)
  const [shortageList, setShortageList] = useState<{ material_name?: string; material_code?: string; shortage?: number }[]>([])
  const [progressCount, setProgressCount] = useState(0)

  // Sevk modalı
  const [shipModalOpen, setShipModalOpen] = useState(false)
  const [shipGearboxId, setShipGearboxId] = useState<string | null>(null)
  const [shipForm, setShipForm] = useState({
    shipment_date: new Date().toISOString().split('T')[0],
    customer_name: '', delivery_address: '', waybill_number: '', invoice_number: '', notes: '',
  })

  const router = useRouter()
  const supabase = createClient()

  // Aktif BOM bilgisini model değişince çek
  useEffect(() => {
    if (!open) return
    void (async () => {
      const { data } = await supabase
        .from('bom_revisions')
        .select('id, bom_items(id)')
        .eq('model', model)
        .eq('is_active', true)
        .limit(1)
        .single()
      if (data) {
        const d = data as { id: string; bom_items?: { id: string }[] }
        setActiveBom({ id: d.id, item_count: Array.isArray(d.bom_items) ? d.bom_items.length : 0 })
      } else {
        setActiveBom(null)
      }
    })()
  }, [model, open])

  const handleCreate = async () => {
    if (!activeBom) {
      toast.error('Bu model için aktif BOM/reçete bulunamadı. Önce BOM tanımlayın.')
      return
    }
    // Eksik parça kontrolü - üretimi engelle
    const { data: shortages } = await supabase.rpc('check_bom_stock_availability', {
      p_bom_revision_id: activeBom.id,
    })
    const shortagesData = (shortages as { material_name?: string; shortage?: number; material_code?: string }[]) ?? []
    if (Array.isArray(shortagesData) && shortagesData.length > 0) {
      setShortageList(shortagesData)
      setShortageModalOpen(true)
      return
    }
    setLoading(true)
    setProgressCount(0)
    const createdGearboxes: typeof gearboxes = []
    try {
      // Kullanıcı bilgisi bir kere al
      const { data: { user } } = await supabase.auth.getUser()
      const finalResponsibleId = responsibleId || user?.id

      for (let i = 0; i < quantity; i++) {
        setProgressCount(i + 1)

        // 1. Seri no üret
        const res = await fetch('/api/seri-no', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ production_date: prodDate, model }),
        })
        const snData = await res.json()
        if (!res.ok) throw new Error(snData.error)

        // 2. Şanzıman kaydı oluştur
        const { data: newGearbox, error } = await supabase
          .from('gearboxes')
          .insert({
            serial_number: snData.serial_number,
            model,
            production_date: prodDate,
            sequence_number: snData.sequence_number,
            status: 'uretimde',
            production_start: new Date().toISOString(),
            responsible_user_id: finalResponsibleId,
            bom_revision_id: activeBom.id,
            work_order: workOrder || null,
            notes,
          })
          .select('*, responsible_user:profiles(full_name)')
          .single()

        if (error) throw error

        // 3. BOM'a göre otomatik stoktan düş + eşleştir
        const { error: deductError } = await supabase.rpc('auto_deduct_stock_for_gearbox', {
          p_gearbox_id: newGearbox.id,
          p_bom_revision_id: activeBom.id,
          p_user_id: user?.id,
        })

        if (deductError) {
          toast.warning(`${snData.serial_number}: Stok düşümünde hata - ${deductError.message}`)
        }

        createdGearboxes.push({ ...newGearbox, parts_mapping_complete: true })
      }

      setGearboxes([...createdGearboxes, ...gearboxes])
      setOpen(false)
      setNotes('')
      setWorkOrder('')
      setResponsibleId('')
      setQuantity(1)
      setProgressCount(0)
      if (quantity === 1) {
        toast.success(`Şanzıman oluşturuldu: ${createdGearboxes[0]?.serial_number} - Stok otomatik düşüldü`)
      } else {
        toast.success(`${quantity} adet şanzıman oluşturuldu - Stok otomatik düşüldü`)
      }
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bir hata oluştu'
      toast.error(message)
      // Zaten oluşturulanları listeye ekle
      if (createdGearboxes.length > 0) {
        setGearboxes([...createdGearboxes, ...gearboxes])
        toast.info(`${createdGearboxes.length}/${quantity} şanzıman oluşturulabildi`)
      }
    } finally {
      setLoading(false)
      setProgressCount(0)
    }
  }

  const handleStatusChange = async (gearboxId: string, newStatus: GearboxStatus) => {
    try {
      const updates: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'final_kontrol_bekliyor') {
        updates.production_end = new Date().toISOString()
      }
      const { error } = await supabase.from('gearboxes').update(updates).eq('id', gearboxId)
      if (error) throw error

      setGearboxes(gearboxes.map(g => g.id === gearboxId ? { ...g, status: newStatus } : g))
      toast.success(`Durum güncellendi: ${STATUS_LABELS[newStatus]}`)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    }
  }

  const openShipModal = (gearboxId: string) => {
    setShipGearboxId(gearboxId)
    setShipForm({
      shipment_date: new Date().toISOString().split('T')[0],
      customer_name: '', delivery_address: '', waybill_number: '', invoice_number: '', notes: '',
    })
    setShipModalOpen(true)
  }

  const handleShipment = async () => {
    if (!shipGearboxId) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Sevkiyat kaydı oluştur
      const { error: shipError } = await supabase.from('shipments').insert({
        gearbox_id: shipGearboxId,
        shipment_date: shipForm.shipment_date,
        customer_name: shipForm.customer_name,
        delivery_address: shipForm.delivery_address,
        waybill_number: shipForm.waybill_number,
        invoice_number: shipForm.invoice_number,
        notes: shipForm.notes,
        shipped_by: user?.id,
      })
      if (shipError) throw shipError

      // Durumu güncelle
      const { error: statusError } = await supabase.from('gearboxes').update({ status: 'sevk_edildi' }).eq('id', shipGearboxId)
      if (statusError) throw statusError

      setGearboxes(gearboxes.map(g => g.id === shipGearboxId ? { ...g, status: 'sevk_edildi' as GearboxStatus } : g))
      setShipModalOpen(false)
      setShipGearboxId(null)
      toast.success('Sevkiyat kaydı oluşturuldu')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const filteredGearboxes = gearboxes.filter(g => {
    const matchSearch = !searchTerm ||
      g.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.work_order?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchModel = filterModel === 'all' || g.model === filterModel
    const matchStatus = filterStatus === 'all' || g.status === filterStatus
    return matchSearch && matchModel && matchStatus
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Şanzıman Üretim</h1>
          <p className="text-sm text-muted-foreground mt-1">Üretim kayıtları ve durum takibi</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Yeni Üretim Başlat</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Yeni Şanzıman Üretimi</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Üretim Tarihi</Label>
                  <Input type="date" value={prodDate} onChange={(e) => setProdDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {gearboxModels.map((m) => (
                        <SelectItem key={m.id} value={m.code}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Sorumlu</Label>
                  <Select value={responsibleId || 'current'} onValueChange={(v) => setResponsibleId(v === 'current' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Mevcut kullanıcı" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Mevcut kullanıcı</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>İş Emri No</Label>
                  <Input value={workOrder} onChange={(e) => setWorkOrder(e.target.value)} placeholder="Opsiyonel" />
                </div>
              </div>

              {/* Adet Seçimi */}
              <div className="space-y-2">
                <Label>Üretim Adedi</Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      className="px-3 py-2 hover:bg-muted transition-colors text-lg font-bold disabled:opacity-30"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    >−</button>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      className="w-16 text-center border-0 border-x rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      className="px-3 py-2 hover:bg-muted transition-colors text-lg font-bold disabled:opacity-30"
                      disabled={quantity >= 50}
                      onClick={() => setQuantity(q => Math.min(50, q + 1))}
                    >+</button>
                  </div>
                  <div className="flex gap-1">
                    {[1, 5, 10].map(n => (
                      <Button key={n} type="button" variant={quantity === n ? 'default' : 'outline'} size="sm" onClick={() => setQuantity(n)} className="h-9 min-w-[40px]">
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {activeBom && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>BOM reçetesi hazır ({activeBom.item_count} malzeme) - {quantity > 1 ? `${quantity} adet için stoktan düşülecek` : 'Stoktan otomatik düşülecek'}</span>
                </div>
              )}
              {!activeBom && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-sm text-red-700 dark:text-red-400">
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>Model {model} için aktif BOM bulunamadı. Önce BOM/Reçete modülünden oluşturun.</span>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notlar (opsiyonel)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Üretim notları..." />
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                <Factory className="w-4 h-4 inline mr-1" />
                {quantity > 1 ? (
                  <span><strong>{quantity}</strong> adet seri numarası otomatik üretilecek: <strong>{prodDate.split('-').reverse().map(s => s.slice(-2)).join('')}-{model}-01</strong> ... <strong>{prodDate.split('-').reverse().map(s => s.slice(-2)).join('')}-{model}-{String(quantity).padStart(2, '0')}</strong></span>
                ) : (
                  <span>Seri numarası otomatik üretilecek: <strong>{prodDate.split('-').reverse().map(s => s.slice(-2)).join('')}-{model}-XX</strong></span>
                )}
              </div>
              <Button onClick={handleCreate} disabled={loading || !activeBom} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {quantity > 1 ? `Oluşturuluyor ${progressCount}/${quantity}...` : 'Oluşturuluyor...'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {quantity > 1 ? `${quantity} Adet Üretim Başlat` : 'Üretimi Başlat'}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Eksik Parça Uyarı Modalı */}
        <Dialog open={shortageModalOpen} onOpenChange={setShortageModalOpen}>
          <DialogContent className="max-w-md sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Eksik Parça - Üretim Yapılamaz</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Stokta yeterli malzeme bulunmuyor. Aşağıdaki parçaları tedarik edin.
                  </p>
                </div>
              </div>
            </DialogHeader>
            <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-red-200 dark:border-red-800 hover:bg-transparent">
                    <TableHead className="font-semibold">Malzeme</TableHead>
                    <TableHead className="font-semibold text-right">Eksik Miktar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shortageList.map((s, i) => (
                    <TableRow key={i} className="border-red-200/50 dark:border-red-800/50">
                      <TableCell className="font-medium">{s.material_name || s.material_code || '-'}</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400 font-semibold">
                        {s.shortage ?? 0} adet
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="mt-4 sm:justify-center">
              <Button onClick={() => setShortageModalOpen(false)} variant="outline" className="min-w-[120px]">
                Tamam
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-10" placeholder="Seri no, iş emri ile ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={filterModel} onValueChange={setFilterModel}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Model" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Modeller</SelectItem>
                {gearboxModels.map((m) => (
                  <SelectItem key={m.id} value={m.code}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seri No</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Üretim Tarihi</TableHead>
                <TableHead>İş Emri</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Sorumlu</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGearboxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Kayıt bulunamadı</TableCell>
                </TableRow>
              ) : (
                filteredGearboxes.map((g) => (
                  <TableRow key={g.id} className="group">
                    <TableCell className="font-mono font-medium">{g.serial_number}</TableCell>
                    <TableCell><Badge variant="outline">{gearboxModels.find(m => m.code === g.model)?.name ?? g.model}</Badge></TableCell>
                    <TableCell>{new Date(g.production_date).toLocaleDateString('tr-TR')}</TableCell>
                    <TableCell className="text-muted-foreground">{g.work_order || '-'}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[g.status]} variant="outline">{STATUS_LABELS[g.status]}</Badge>
                    </TableCell>
                    <TableCell>{g.responsible_user?.full_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {g.status === 'uretimde' && (
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(g.id, 'final_kontrol_bekliyor')}>
                            <CheckCircle className="w-3 h-3 mr-1" />Üretimi Tamamla
                          </Button>
                        )}
                        {g.status === 'stokta' && (
                          <Button variant="outline" size="sm" onClick={() => openShipModal(g.id)}>
                            <Truck className="w-3 h-3 mr-1" />Sevk Et
                          </Button>
                        )}
                        <Link href={`/uretim/${g.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="w-4 h-4 mr-1" />Detay</Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sevk Bilgi Girişi Modalı */}
      <Dialog open={shipModalOpen} onOpenChange={v => { setShipModalOpen(v); if (!v) setShipGearboxId(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />Sevkiyat Bilgisi
            </DialogTitle>
          </DialogHeader>
          {shipGearboxId && (() => {
            const g = gearboxes.find(x => x.id === shipGearboxId)
            return g ? (
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300 mb-2">
                <strong>{g.serial_number}</strong> ({gearboxModels.find(m => m.code === g.model)?.name ?? g.model}) sevk edilecek
              </div>
            ) : null
          })()}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sevk Tarihi</Label>
                <Input type="date" value={shipForm.shipment_date} onChange={e => setShipForm({ ...shipForm, shipment_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Müşteri</Label>
                <Input value={shipForm.customer_name} onChange={e => setShipForm({ ...shipForm, customer_name: e.target.value })} placeholder="Müşteri adı" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>İrsaliye No</Label>
                <Input value={shipForm.waybill_number} onChange={e => setShipForm({ ...shipForm, waybill_number: e.target.value })} placeholder="İrsaliye numarası" />
              </div>
              <div className="space-y-2">
                <Label>Fatura No</Label>
                <Input value={shipForm.invoice_number} onChange={e => setShipForm({ ...shipForm, invoice_number: e.target.value })} placeholder="Fatura numarası" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Teslimat Adresi</Label>
              <Input value={shipForm.delivery_address} onChange={e => setShipForm({ ...shipForm, delivery_address: e.target.value })} placeholder="Teslimat adresi" />
            </div>
            <div className="space-y-2">
              <Label>Notlar</Label>
              <Textarea value={shipForm.notes} onChange={e => setShipForm({ ...shipForm, notes: e.target.value })} placeholder="Sevkiyat notları..." />
            </div>
            <Button onClick={handleShipment} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Truck className="w-4 h-4 mr-2" />}
              Sevk Et
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
