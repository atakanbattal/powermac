'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MODEL_LABELS, MODEL_COLORS, STATUS_LABELS } from '@/lib/constants'
import type { GearboxModel, GearboxStatus } from '@/lib/types'
import {
  PackageCheck, Box, TrendingUp, MoreHorizontal, Pencil, Trash2,
  AlertTriangle, Recycle, RotateCcw, Loader2, Save, Search
} from 'lucide-react'
import { toast } from 'sonner'
import { DateRangeFilter } from '@/components/date-range-filter'

interface StockGearbox {
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
}

interface Props {
  stockGearboxes: StockGearbox[]
  revizyonGearboxes: StockGearbox[]
  allGearboxes: { model: string; status: string }[]
  dateRangeStart: string
  dateRangeEnd: string
}

export function BitimisUrunStokClient({ stockGearboxes: initGearboxes, revizyonGearboxes: initRevizyon, allGearboxes, dateRangeStart, dateRangeEnd }: Props) {
  const [gearboxes, setGearboxes] = useState(initGearboxes)
  const [revizyonGearboxes, setRevizyonGearboxes] = useState(initRevizyon)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [revizyonSearch, setRevizyonSearch] = useState('')

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editingGearbox, setEditingGearbox] = useState<StockGearbox | null>(null)
  const [editForm, setEditForm] = useState({ work_order: '', notes: '' })

  // Scrap / Status change modal
  const [actionOpen, setActionOpen] = useState(false)
  const [actionType, setActionType] = useState<'scrap' | 'revizyon' | 'final_kontrol' | 'uretim'>('scrap')
  const [actionGearbox, setActionGearbox] = useState<StockGearbox | null>(null)
  const [actionNotes, setActionNotes] = useState('')

  const router = useRouter()
  const supabase = createClient()

  // Model bazında stok sayımı
  const stockByModel = { A: 0, B: 0, C: 0 }
  gearboxes.forEach(g => {
    const m = g.model as keyof typeof stockByModel
    if (stockByModel[m] !== undefined) stockByModel[m]++
  })
  const totalStock = stockByModel.A + stockByModel.B + stockByModel.C

  // Toplam üretim sayıları
  const totalByModel = { A: 0, B: 0, C: 0 }
  allGearboxes.forEach(g => {
    const m = g.model as keyof typeof totalByModel
    if (totalByModel[m] !== undefined) totalByModel[m]++
  })

  const getResponsibleName = (ru: StockGearbox['responsible_user']) => {
    if (!ru) return '-'
    if (Array.isArray(ru)) return ru[0]?.full_name || '-'
    return ru.full_name || '-'
  }

  // Filtered gearboxes
  const filteredGearboxes = gearboxes.filter(g =>
    g.serial_number.toLowerCase().includes(search.toLowerCase()) ||
    g.model.toLowerCase().includes(search.toLowerCase()) ||
    (g.work_order || '').toLowerCase().includes(search.toLowerCase())
  )

  // === DÜZENLE ===
  const openEdit = (g: StockGearbox) => {
    setEditingGearbox(g)
    setEditForm({ work_order: g.work_order || '', notes: g.notes || '' })
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingGearbox) return
    setLoading(true)
    try {
      const { error } = await supabase.from('gearboxes').update({
        work_order: editForm.work_order || null,
        notes: editForm.notes || null,
      }).eq('id', editingGearbox.id)
      if (error) throw error

      setGearboxes(gearboxes.map(g => g.id === editingGearbox.id
        ? { ...g, work_order: editForm.work_order, notes: editForm.notes }
        : g
      ))
      setEditOpen(false)
      setEditingGearbox(null)
      toast.success('Ürün güncellendi')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata oluştu')
    } finally { setLoading(false) }
  }

  // === SİL (soft-delete: hurdaya) ===
  const handleDelete = async (g: StockGearbox) => {
    if (!confirm(`"${g.serial_number}" seri nolu ürünü hurdaya ayırmak istediğinize emin misiniz?\n\nÜrün stoktan çıkarılacak ve listede görünmeyecektir.`)) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('audit_logs').insert({
        entity_type: 'gearboxes',
        entity_id: g.id,
        action: 'HURDAYA',
        old_values: { serial_number: g.serial_number, model: g.model, status: g.status },
        new_values: { reason: 'Kalıcı sil ile hurdaya ayrıldı' },
        user_id: user?.id,
        user_name: user?.email,
      })
      const { error } = await supabase.from('gearboxes').update({ status: 'hurdaya' }).eq('id', g.id)
      if (error) throw error
      setGearboxes(gearboxes.filter(gb => gb.id !== g.id))
      toast.success(`${g.serial_number} hurdaya ayrıldı`)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'İşlem hatası')
    } finally { setLoading(false) }
  }

  // === İŞLEM (Hurdaya ayır, Revizyon/İade, Sevkiyat - Sevkiyat modülünde) ===
  const openAction = (g: StockGearbox, type: 'scrap' | 'revizyon' | 'final_kontrol' | 'uretim') => {
    setActionGearbox(g)
    setActionType(type)
    setActionNotes('')
    setActionOpen(true)
  }

  const handleAction = async () => {
    if (!actionGearbox) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (actionType === 'scrap') {
        // Hurdaya ayır: soft-delete (status=hurdaya) + audit log
        const prevStatus = actionGearbox.status || 'stokta'
        await supabase.from('audit_logs').insert({
          entity_type: 'gearboxes',
          entity_id: actionGearbox.id,
          action: 'HURDAYA',
          old_values: { serial_number: actionGearbox.serial_number, model: actionGearbox.model, status: prevStatus },
          new_values: { reason: 'Hurdaya ayrıldı', notes: actionNotes },
          user_id: user?.id,
          user_name: user?.email,
        })

        const { error } = await supabase.from('gearboxes').update({ status: 'hurdaya' }).eq('id', actionGearbox.id)
        if (error) throw error
        setGearboxes(gearboxes.filter(g => g.id !== actionGearbox.id))
        setRevizyonGearboxes(revizyonGearboxes.filter(g => g.id !== actionGearbox.id))
        toast.success(`${actionGearbox.serial_number} hurdaya ayrıldı`)
      } else if (actionType === 'revizyon') {
        // Revizyon/İade
        const { error } = await supabase.from('gearboxes').update({
          status: 'revizyon_iade',
          notes: actionNotes ? `${actionGearbox.notes ? actionGearbox.notes + ' | ' : ''}Revizyon: ${actionNotes}` : actionGearbox.notes,
        }).eq('id', actionGearbox.id)
        if (error) throw error
        setGearboxes(gearboxes.filter(g => g.id !== actionGearbox.id))
        setRevizyonGearboxes([{ ...actionGearbox, status: 'revizyon_iade', notes: actionNotes ? `${actionGearbox.notes ? actionGearbox.notes + ' | ' : ''}Revizyon: ${actionNotes}` : actionGearbox.notes }, ...revizyonGearboxes])
        toast.success(`${actionGearbox.serial_number} revizyona gönderildi`)
      } else if (actionType === 'final_kontrol') {
        // Revizyon'dan tekrar kalite kontrole
        const { error } = await supabase.from('gearboxes').update({
          status: 'final_kontrol_bekliyor',
          notes: actionNotes ? `${actionGearbox.notes ? actionGearbox.notes + ' | ' : ''}Tekrar KK: ${actionNotes}` : actionGearbox.notes,
        }).eq('id', actionGearbox.id)
        if (error) throw error
        setRevizyonGearboxes(revizyonGearboxes.filter(g => g.id !== actionGearbox.id))
        toast.success(`${actionGearbox.serial_number} tekrar kalite kontrole gönderildi`)
      } else if (actionType === 'uretim') {
        // Revizyon'dan üretime geri alma
        const { error } = await supabase.from('gearboxes').update({
          status: 'uretimde',
          production_end: null,
          notes: actionNotes ? `${actionGearbox.notes ? actionGearbox.notes + ' | ' : ''}Üretime geri: ${actionNotes}` : actionGearbox.notes,
        }).eq('id', actionGearbox.id)
        if (error) throw error
        setRevizyonGearboxes(revizyonGearboxes.filter(g => g.id !== actionGearbox.id))
        toast.success(`${actionGearbox.serial_number} üretime geri alındı`)
      }

      setActionOpen(false)
      setActionGearbox(null)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'İşlem hatası')
    } finally { setLoading(false) }
  }

  const ACTION_CONFIG = {
    scrap: { title: 'Hurdaya Ayır', icon: Recycle, color: 'text-red-600', bg: 'bg-red-50', desc: 'Bu ürün kalıcı olarak hurdaya ayrılacak ve sistemden silinecektir.' },
    revizyon: { title: 'Revizyona Gönder', icon: RotateCcw, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Bu ürün revizyon/iade durumuna alınacak ve stoktan çıkacaktır.' },
    final_kontrol: { title: 'Tekrar Kalite Kontrole Gönder', icon: RotateCcw, color: 'text-blue-600', bg: 'bg-blue-50', desc: 'Bu ürün tekrar Final Kalite Kontrol sürecine gönderilecektir.' },
    uretim: { title: 'Üretime Geri Al', icon: RotateCcw, color: 'text-slate-600', bg: 'bg-slate-50', desc: 'Bu ürün üretim sürecine geri alınacaktır.' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bitmiş Ürün Stok</h1>
          <p className="text-sm text-muted-foreground mt-1">Kalite kontrolden geçen ve stokta bekleyen şanzımanlar</p>
        </div>
        <DateRangeFilter start={dateRangeStart} end={dateRangeEnd} label="Üretim Tarihi" />
      </div>

      {/* Stok Özet Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-slate-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplam Stok</p>
                <p className="text-3xl font-bold">{totalStock}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <PackageCheck className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {(['A', 'B', 'C'] as GearboxModel[]).map(model => (
          <Card key={model} className="border-l-4" style={{ borderLeftColor: MODEL_COLORS[model] }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{MODEL_LABELS[model]}</p>
                  <p className="text-3xl font-bold">{stockByModel[model as keyof typeof stockByModel] ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Toplam üretim: {totalByModel[model as keyof typeof totalByModel] ?? 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: MODEL_COLORS[model] + '20' }}>
                  <Box className="w-6 h-6" style={{ color: MODEL_COLORS[model] }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stok Tablosu */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-5 h-5" />
              Stoktaki Şanzımanlar ({totalStock})
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Seri no, model veya iş emri ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seri No</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Üretim Tarihi</TableHead>
                <TableHead>İş Emri</TableHead>
                <TableHead>Sorumlu</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGearboxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <PackageCheck className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                    <p>{search ? 'Arama sonucu bulunamadı' : 'Stokta şanzıman bulunmuyor'}</p>
                    <p className="text-xs mt-1">Kalite kontrolden geçen ürünler burada görünecek</p>
                  </TableCell>
                </TableRow>
              ) : filteredGearboxes.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono font-bold">{g.serial_number}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{ borderColor: MODEL_COLORS[g.model as GearboxModel], color: MODEL_COLORS[g.model as GearboxModel] }}
                    >
                      {MODEL_LABELS[g.model as GearboxModel]}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(g.production_date).toLocaleDateString('tr-TR')}</TableCell>
                  <TableCell className="font-mono text-sm">{g.work_order || '-'}</TableCell>
                  <TableCell>{getResponsibleName(g.responsible_user)}</TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                      Stokta
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => openEdit(g)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openAction(g, 'revizyon')}>
                          <RotateCcw className="w-4 h-4 mr-2 text-amber-600" />
                          <span className="text-amber-600">Revizyona Gönder</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAction(g, 'scrap')}>
                          <Recycle className="w-4 h-4 mr-2 text-red-600" />
                          <span className="text-red-600">Hurdaya Ayır</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(g)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Kalıcı Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Revizyon/İade Bölümü */}
      {revizyonGearboxes.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                Revizyon / İade ({revizyonGearboxes.length})
              </CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Seri no, model ara..." value={revizyonSearch} onChange={e => setRevizyonSearch(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Revizyona gönderilen ürünler. Tekrar kalite kontrole gönderin veya üretime geri alın.</p>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seri No</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Üretim Tarihi</TableHead>
                  <TableHead>İş Emri</TableHead>
                  <TableHead>Sorumlu</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revizyonGearboxes
                  .filter(g => !revizyonSearch || g.serial_number.toLowerCase().includes(revizyonSearch.toLowerCase()) || g.model.toLowerCase().includes(revizyonSearch.toLowerCase()))
                  .map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono font-bold">{g.serial_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline" style={{ borderColor: MODEL_COLORS[g.model as GearboxModel], color: MODEL_COLORS[g.model as GearboxModel] }}>
                        {MODEL_LABELS[g.model as GearboxModel]}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(g.production_date).toLocaleDateString('tr-TR')}</TableCell>
                    <TableCell className="font-mono text-sm">{g.work_order || '-'}</TableCell>
                    <TableCell>{getResponsibleName(g.responsible_user)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => openAction(g, 'final_kontrol')}>
                            <RotateCcw className="w-4 h-4 mr-2 text-blue-600" />
                            <span className="text-blue-600">Tekrar Kalite Kontrole Gönder</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAction(g, 'uretim')}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Üretime Geri Al
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openAction(g, 'scrap')}>
                            <Recycle className="w-4 h-4 mr-2 text-red-600" />
                            <span className="text-red-600">Hurdaya Ayır</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Düzenleme Modalı */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ürün Düzenle: {editingGearbox?.serial_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Seri No</Label>
                <p className="font-mono font-bold">{editingGearbox?.serial_number}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Model</Label>
                <p className="font-medium">{editingGearbox?.model ? MODEL_LABELS[editingGearbox.model as GearboxModel] : '-'}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>İş Emri</Label>
              <Input
                value={editForm.work_order}
                onChange={e => setEditForm({ ...editForm, work_order: e.target.value })}
                placeholder="İş emri numarası"
              />
            </div>
            <div className="space-y-2">
              <Label>Notlar</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Ürünle ilgili notlar..."
                rows={3}
              />
            </div>
            <Button onClick={handleUpdate} disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Güncelle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* İşlem Onay Modalı (Hurdaya Ayır / Revizyon / Sevk) */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType && (() => {
                const Icon = ACTION_CONFIG[actionType].icon
                return <Icon className={`w-5 h-5 ${ACTION_CONFIG[actionType].color}`} />
              })()}
              {ACTION_CONFIG[actionType]?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className={`p-4 rounded-lg ${ACTION_CONFIG[actionType]?.bg} border`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono font-bold text-lg">{actionGearbox?.serial_number}</span>
                <Badge variant="outline">
                  {actionGearbox?.model ? MODEL_LABELS[actionGearbox.model as GearboxModel] : ''}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {ACTION_CONFIG[actionType]?.desc}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Açıklama / Sebep</Label>
              <Textarea
                value={actionNotes}
                onChange={e => setActionNotes(e.target.value)}
                placeholder="İşlem sebebini yazın..."
                rows={3}
              />
            </div>

            {actionType === 'scrap' && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Bu işlem geri alınamaz! Ürün kalıcı olarak sistemden silinecektir.</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setActionOpen(false)} className="flex-1">
                İptal
              </Button>
              <Button
                onClick={handleAction}
                disabled={loading}
                variant={actionType === 'scrap' ? 'destructive' : 'default'}
                className="flex-1"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {ACTION_CONFIG[actionType]?.title}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
