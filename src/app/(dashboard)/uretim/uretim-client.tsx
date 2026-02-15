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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { STATUS_LABELS, STATUS_COLORS, MODEL_LABELS } from '@/lib/constants'
import type { Gearbox, GearboxModel, GearboxStatus } from '@/lib/types'
import type { Profile } from '@/lib/types'
import { Plus, Factory, Search, Loader2, Eye, FileText, User, CheckCircle, Truck, Wrench } from 'lucide-react'
import { toast } from 'sonner'

interface UretimClientProps {
  gearboxes: (Gearbox & { responsible_user?: { full_name: string } | null })[]
  profiles: Pick<Profile, 'id' | 'full_name' | 'role'>[]
}

export function UretimClient({ gearboxes: initialGearboxes, profiles }: UretimClientProps) {
  const [gearboxes, setGearboxes] = useState(initialGearboxes)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModel, setFilterModel] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Form state
  const [prodDate, setProdDate] = useState(new Date().toISOString().split('T')[0])
  const [model, setModel] = useState<GearboxModel>('A')
  const [responsibleId, setResponsibleId] = useState<string>('')
  const [workOrder, setWorkOrder] = useState('')
  const [notes, setNotes] = useState('')
  const [activeBom, setActiveBom] = useState<{ id: string; item_count: number } | null>(null)

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
    setLoading(true)
    try {
      // 1. Seri no üret
      const res = await fetch('/api/seri-no', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ production_date: prodDate, model }),
      })
      const snData = await res.json()
      if (!res.ok) throw new Error(snData.error)

      // 2. Kullanıcı bilgisi
      const { data: { user } } = await supabase.auth.getUser()
      const finalResponsibleId = responsibleId || user?.id

      // 3. Şanzıman kaydı oluştur
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

      // 4. BOM'a göre otomatik stoktan düş + eşleştir
      const { data: mappings, error: deductError } = await supabase.rpc('auto_deduct_stock_for_gearbox', {
        p_gearbox_id: newGearbox.id,
        p_bom_revision_id: activeBom.id,
        p_user_id: user?.id,
      })

      if (deductError) {
        toast.warning(`Şanzıman oluşturuldu ama stok düşümünde hata: ${deductError.message}`)
      } else {
        // Eksik stok uyarıları
        const warnings = (mappings as { shortage?: number; material_name?: string }[])?.filter((m: { shortage?: number }) => m.shortage && m.shortage > 0)
        if (warnings && warnings.length > 0) {
          const names = warnings.map((w: { material_name?: string }) => w.material_name).join(', ')
          toast.warning(`Yetersiz stok: ${names}`)
        }
      }

      setGearboxes([{ ...newGearbox, parts_mapping_complete: true }, ...gearboxes])
      setOpen(false)
      setNotes('')
      setWorkOrder('')
      setResponsibleId('')
      toast.success(`Şanzıman oluşturuldu: ${snData.serial_number} - Stok otomatik düşüldü`)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bir hata oluştu'
      toast.error(message)
    } finally {
      setLoading(false)
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
                  <Select value={model} onValueChange={(v) => setModel(v as GearboxModel)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Model A</SelectItem>
                      <SelectItem value="B">Model B</SelectItem>
                      <SelectItem value="C">Model C</SelectItem>
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

              {activeBom && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>BOM reçetesi hazır ({activeBom.item_count} malzeme) - Stoktan otomatik düşülecek</span>
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
                Seri numarası otomatik üretilecek: <strong>{prodDate.split('-').reverse().map(s => s.slice(-2)).join('')}-{model}-XX</strong>
              </div>
              <Button onClick={handleCreate} disabled={loading || !activeBom} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Üretimi Başlat
              </Button>
            </div>
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
                <SelectItem value="A">Model A</SelectItem>
                <SelectItem value="B">Model B</SelectItem>
                <SelectItem value="C">Model C</SelectItem>
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
                    <TableCell><Badge variant="outline">{MODEL_LABELS[g.model]}</Badge></TableCell>
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
                            <CheckCircle className="w-3 h-3 mr-1" />Tamamla
                          </Button>
                        )}
                        {g.status === 'stokta' && (
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(g.id, 'sevk_edildi')}>
                            <Truck className="w-3 h-3 mr-1" />Sevk
                          </Button>
                        )}
                        {g.status === 'sevk_edildi' && (
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(g.id, 'montajlandi')}>
                            <Wrench className="w-3 h-3 mr-1" />Montaj
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
    </div>
  )
}
