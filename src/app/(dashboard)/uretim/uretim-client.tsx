'use client'

import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { STATUS_LABELS, STATUS_COLORS, MODEL_LABELS } from '@/lib/constants'
import type { Gearbox, GearboxModel, GearboxStatus } from '@/lib/types'
import { Plus, Factory, Search, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'

interface UretimClientProps {
  gearboxes: (Gearbox & { responsible_user?: { full_name: string } | null })[]
}

export function UretimClient({ gearboxes: initialGearboxes }: UretimClientProps) {
  const [gearboxes, setGearboxes] = useState(initialGearboxes)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModel, setFilterModel] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Form state
  const [prodDate, setProdDate] = useState(new Date().toISOString().split('T')[0])
  const [model, setModel] = useState<GearboxModel>('A')
  const [notes, setNotes] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const handleCreate = async () => {
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

      // 2. Aktif BOM'u bul
      const { data: activeBom } = await supabase
        .from('bom_revisions')
        .select('id')
        .eq('model', model)
        .eq('is_active', true)
        .order('revision_no', { ascending: false })
        .limit(1)
        .single()

      // 3. Kullanıcı bilgisi
      const { data: { user } } = await supabase.auth.getUser()

      // 4. Şanzıman kaydı oluştur
      const { data: newGearbox, error } = await supabase
        .from('gearboxes')
        .insert({
          serial_number: snData.serial_number,
          model,
          production_date: prodDate,
          sequence_number: snData.sequence_number,
          status: 'uretimde',
          production_start: new Date().toISOString(),
          responsible_user_id: user?.id,
          bom_revision_id: activeBom?.id || null,
          notes,
        })
        .select('*, responsible_user:profiles(full_name)')
        .single()

      if (error) throw error

      setGearboxes([newGearbox, ...gearboxes])
      setOpen(false)
      setNotes('')
      toast.success(`Şanzıman oluşturuldu: ${snData.serial_number}`)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bir hata oluştu'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const filteredGearboxes = gearboxes.filter(g => {
    const matchSearch = !searchTerm || 
      g.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
          <p className="text-sm text-muted-foreground mt-1">Üretim kayıtları ve seri numarası yönetimi</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Yeni Üretim Başlat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Şanzıman Üretimi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Üretim Tarihi</Label>
                  <Input
                    type="date"
                    value={prodDate}
                    onChange={(e) => setProdDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={(v) => setModel(v as GearboxModel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Model A</SelectItem>
                      <SelectItem value="B">Model B</SelectItem>
                      <SelectItem value="C">Model C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notlar (opsiyonel)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Üretim ile ilgili notlar..."
                />
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                <Factory className="w-4 h-4 inline mr-1" />
                Seri numarası otomatik üretilecek: <strong>{prodDate.split('-').reverse().map(s => s.slice(-2)).join('')}-{model}-XX</strong>
              </div>
              <Button onClick={handleCreate} disabled={loading} className="w-full">
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
              <Input
                className="pl-10"
                placeholder="Seri no ile ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterModel} onValueChange={setFilterModel}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Modeller</SelectItem>
                <SelectItem value="A">Model A</SelectItem>
                <SelectItem value="B">Model B</SelectItem>
                <SelectItem value="C">Model C</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
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
                <TableHead>Durum</TableHead>
                <TableHead>Sorumlu</TableHead>
                <TableHead>Parça Eşleş.</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGearboxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Kayıt bulunamadı
                  </TableCell>
                </TableRow>
              ) : (
                filteredGearboxes.map((g) => (
                  <TableRow key={g.id} className="group">
                    <TableCell className="font-mono font-medium">{g.serial_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{MODEL_LABELS[g.model]}</Badge>
                    </TableCell>
                    <TableCell>{new Date(g.production_date).toLocaleDateString('tr-TR')}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[g.status]} variant="outline">
                        {STATUS_LABELS[g.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{g.responsible_user?.full_name || '-'}</TableCell>
                    <TableCell>
                      {g.parts_mapping_complete ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Tamam</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">Bekliyor</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/uretim/${g.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4 mr-1" /> Detay
                        </Button>
                      </Link>
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
