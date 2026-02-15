'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MODEL_LABELS } from '@/lib/constants'
import type { BomRevision, BomItem, GearboxModel } from '@/lib/types'
import { Plus, FileText, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface BomClientProps {
  bomRevisions: (BomRevision & { bom_items: (BomItem & { material?: { code: string; name: string; unit: string } | null })[] })[]
  materials: { id: string; code: string; name: string; unit: string }[]
}

export function BomClient({ bomRevisions: initRevs, materials }: BomClientProps) {
  const [revisions, setRevisions] = useState(initRevs)
  const [open, setOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('all')
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null)
  const [newModel, setNewModel] = useState<GearboxModel>('A')
  const [newDesc, setNewDesc] = useState('')
  const [itemForm, setItemForm] = useState({ material_id: '', quantity_per_unit: '1', is_critical: false })
  const router = useRouter()
  const supabase = createClient()

  const handleCreateRevision = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const maxRev = revisions.filter(r => r.model === newModel).reduce((max, r) => Math.max(max, r.revision_no), 0)

      // Önceki aktif revizyonu pasif yap
      await supabase.from('bom_revisions').update({ is_active: false }).eq('model', newModel).eq('is_active', true)

      const { data, error } = await supabase.from('bom_revisions').insert({
        model: newModel,
        revision_no: maxRev + 1,
        description: newDesc,
        is_active: true,
        created_by: user?.id,
      }).select('*, bom_items(*, material:materials(code, name, unit))').single()
      if (error) throw error
      setRevisions([data, ...revisions.map(r => r.model === newModel ? { ...r, is_active: false } : r)])
      setOpen(false)
      setNewDesc('')
      toast.success('Yeni BOM revizyonu oluşturuldu')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleAddItem = async () => {
    if (!selectedRevId || !itemForm.material_id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('bom_items').insert({
        bom_revision_id: selectedRevId,
        material_id: itemForm.material_id,
        quantity_per_unit: parseFloat(itemForm.quantity_per_unit) || 1,
        is_critical: itemForm.is_critical,
      }).select('*, material:materials(code, name, unit)').single()
      if (error) throw error
      setRevisions(revisions.map(r => r.id === selectedRevId ? { ...r, bom_items: [...r.bom_items, data] } : r))
      setItemOpen(false)
      setItemForm({ material_id: '', quantity_per_unit: '1', is_critical: false })
      toast.success('BOM satırı eklendi')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleDeleteItem = async (revId: string, itemId: string) => {
    await supabase.from('bom_items').delete().eq('id', itemId)
    setRevisions(revisions.map(r => r.id === revId ? { ...r, bom_items: r.bom_items.filter(i => i.id !== itemId) } : r))
    toast.success('Satır silindi')
  }

  const filtered = selectedModel === 'all' ? revisions : revisions.filter(r => r.model === selectedModel)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BOM / Ürün Reçetesi</h1>
          <p className="text-sm text-muted-foreground mt-1">Model bazlı malzeme ihtiyaç listesi yönetimi</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Modeller</SelectItem>
              <SelectItem value="A">Model A</SelectItem>
              <SelectItem value="B">Model B</SelectItem>
              <SelectItem value="C">Model C</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Yeni Revizyon</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Yeni BOM Revizyonu</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={newModel} onValueChange={v => setNewModel(v as GearboxModel)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Model A</SelectItem>
                      <SelectItem value="B">Model B</SelectItem>
                      <SelectItem value="C">Model C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Açıklama</Label>
                  <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Revizyon açıklaması" />
                </div>
                <Button onClick={handleCreateRevision} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Revizyon Oluştur
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.map(rev => (
        <Card key={rev.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base">{MODEL_LABELS[rev.model]} - Rev {rev.revision_no}</CardTitle>
                <p className="text-xs text-muted-foreground">{rev.description || 'Açıklama yok'} &bull; {new Date(rev.effective_date).toLocaleDateString('tr-TR')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {rev.is_active && <Badge className="bg-emerald-100 text-emerald-700">Aktif</Badge>}
              <Dialog open={itemOpen && selectedRevId === rev.id} onOpenChange={v => { setItemOpen(v); if (v) setSelectedRevId(rev.id) }}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-3 h-3 mr-1" />Satır Ekle</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>BOM Satırı Ekle</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Malzeme</Label>
                      <Select value={itemForm.material_id} onValueChange={v => setItemForm({...itemForm, material_id: v})}>
                        <SelectTrigger><SelectValue placeholder="Malzeme seçin" /></SelectTrigger>
                        <SelectContent>
                          {materials.map(m => <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Birim Başına Miktar</Label>
                      <Input type="number" step="0.001" value={itemForm.quantity_per_unit} onChange={e => setItemForm({...itemForm, quantity_per_unit: e.target.value})} />
                    </div>
                    <Button onClick={handleAddItem} disabled={loading} className="w-full">
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Ekle
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Malzeme Kodu</TableHead>
                  <TableHead>Adı</TableHead>
                  <TableHead className="text-right">Miktar</TableHead>
                  <TableHead>Birim</TableHead>
                  <TableHead>Kritik</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rev.bom_items.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Henüz satır eklenmedi</TableCell></TableRow>
                ) : rev.bom_items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.material?.code}</TableCell>
                    <TableCell className="font-medium">{item.material?.name}</TableCell>
                    <TableCell className="text-right font-bold">{item.quantity_per_unit}</TableCell>
                    <TableCell>{item.material?.unit}</TableCell>
                    <TableCell>{item.is_critical ? <Badge variant="destructive" className="text-xs">Kritik</Badge> : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(rev.id, item.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
