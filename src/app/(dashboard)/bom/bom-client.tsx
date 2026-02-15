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
import { Checkbox } from '@/components/ui/checkbox'
import { MODEL_LABELS } from '@/lib/constants'
import type { BomRevision, BomItem, GearboxModel } from '@/lib/types'
import { Plus, FileText, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface BomClientProps {
  bomRevisions: (BomRevision & { bom_items: (BomItem & { material?: { code: string; name: string; unit: string } | null })[] })[]
  materials: { id: string; code: string; name: string; unit: string }[]
}

export function BomClient({ bomRevisions: initRevs, materials }: BomClientProps) {
  const [revisions, setRevisions] = useState(initRevs)
  const [createOpen, setCreateOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null)

  const [newRecipeModel, setNewRecipeModel] = useState<GearboxModel>('A')
  const [newRecipeDesc, setNewRecipeDesc] = useState('')
  const [itemForm, setItemForm] = useState({ material_id: '', quantity_per_unit: '1', is_critical: false })
  const router = useRouter()
  const supabase = createClient()

  // Aktif reçeteler (model başına 1 tane)
  const activeRecipes = (['A', 'B', 'C'] as const).map(model => {
    const active = revisions.find(r => r.model === model && r.is_active)
    return { model, recipe: active }
  })

  const modelsWithoutBom = activeRecipes.filter(r => !r.recipe).map(r => r.model)

  const handleCreateRecipe = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: newRevId, error: rpcError } = await supabase.rpc('create_bom_revision', {
        p_model: newRecipeModel,
        p_description: newRecipeDesc || `${MODEL_LABELS[newRecipeModel]} reçetesi`,
        p_created_by: user?.id,
      })
      if (rpcError) throw rpcError
      if (!newRevId) throw new Error('Reçete oluşturulamadı')

      const { data: newRev } = await supabase
        .from('bom_revisions')
        .select('*')
        .eq('id', newRevId)
        .single()

      if (newRev) {
        setRevisions([{ ...newRev, bom_items: [] }, ...revisions.map(r => r.model === newRecipeModel ? { ...r, is_active: false } : r)])
      }
      setCreateOpen(false)
      setNewRecipeDesc('')
      toast.success(`${MODEL_LABELS[newRecipeModel]} reçetesi oluşturuldu`)
      router.refresh()
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Hata'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  const handleAddItem = async () => {
    if (!selectedRevId || !itemForm.material_id) return
    setLoading(true)
    try {
      const maxSort = revisions.find(r => r.id === selectedRevId)?.bom_items.length || 0
      const { data, error } = await supabase.from('bom_items').insert({
        bom_revision_id: selectedRevId,
        material_id: itemForm.material_id,
        quantity_per_unit: parseFloat(itemForm.quantity_per_unit) || 1,
        is_critical: itemForm.is_critical,
        sort_order: maxSort,
      }).select('*, material:materials!material_id(code, name, unit)').single()
      if (error) throw error
      setRevisions(revisions.map(r => r.id === selectedRevId ? { ...r, bom_items: [...r.bom_items, data] } : r))
      setAddItemOpen(false)
      setItemForm({ material_id: '', quantity_per_unit: '1', is_critical: false })
      toast.success('Malzeme eklendi')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleDeleteItem = async (revId: string, itemId: string) => {
    if (!confirm('Bu malzemeyi reçeteden kaldırmak istediğinize emin misiniz?')) return
    await supabase.from('bom_items').delete().eq('id', itemId)
    setRevisions(revisions.map(r => r.id === revId ? { ...r, bom_items: r.bom_items.filter(i => i.id !== itemId) } : r))
    toast.success('Malzeme kaldırıldı')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BOM / Ürün Reçetesi</h1>
          <p className="text-sm text-muted-foreground mt-1">Her model için gerekli malzeme listesi</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Yeni Reçete</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yeni Ürün Reçetesi</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={newRecipeModel} onValueChange={v => setNewRecipeModel(v as GearboxModel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Model A</SelectItem>
                    <SelectItem value="B">Model B</SelectItem>
                    <SelectItem value="C">Model C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Açıklama (opsiyonel)</Label>
                <Input value={newRecipeDesc} onChange={e => setNewRecipeDesc(e.target.value)} placeholder="Reçete açıklaması" />
              </div>
              <Button onClick={handleCreateRecipe} disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Reçete Oluştur
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {modelsWithoutBom.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <strong>{modelsWithoutBom.map(m => MODEL_LABELS[m]).join(', ')}</strong> için henüz reçete tanımlanmamış.
            </p>
          </CardContent>
        </Card>
      )}

      {activeRecipes.filter(r => r.recipe).map(({ model, recipe }) => {
        if (!recipe) return null
        return (
          <Card key={recipe.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle className="text-base">{MODEL_LABELS[model]} Reçetesi</CardTitle>
                  <p className="text-xs text-muted-foreground">{recipe.description || ''} &bull; {recipe.bom_items.length} malzeme</p>
                </div>
              </div>
              <Dialog open={addItemOpen && selectedRevId === recipe.id} onOpenChange={v => { setAddItemOpen(v); if (v) setSelectedRevId(recipe.id) }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="w-3 h-3 mr-1" />Malzeme Ekle</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{MODEL_LABELS[model]} - Malzeme Ekle</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Malzeme</Label>
                      <Select value={itemForm.material_id} onValueChange={v => setItemForm({ ...itemForm, material_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Malzeme seçin" /></SelectTrigger>
                        <SelectContent>
                          {materials
                            .filter(m => !recipe.bom_items.some(bi => bi.material_id === m.id))
                            .map(m => <SelectItem key={m.id} value={m.id}>{m.code} - {m.name} ({m.unit})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Adet / Miktar (1 şanzıman için)</Label>
                      <Input type="number" step="0.001" min="0.001" value={itemForm.quantity_per_unit} onChange={e => setItemForm({ ...itemForm, quantity_per_unit: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="critical-bom" checked={itemForm.is_critical} onCheckedChange={c => setItemForm({ ...itemForm, is_critical: !!c })} />
                      <Label htmlFor="critical-bom" className="text-sm cursor-pointer">Kritik malzeme</Label>
                    </div>
                    <Button onClick={handleAddItem} disabled={loading || !itemForm.material_id} className="w-full">
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Ekle
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
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
                    <TableHead className="text-right">Sil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipe.bom_items.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Henüz malzeme eklenmedi</TableCell></TableRow>
                  ) : recipe.bom_items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.material?.code}</TableCell>
                      <TableCell className="font-medium">{item.material?.name}</TableCell>
                      <TableCell className="text-right font-bold">{item.quantity_per_unit}</TableCell>
                      <TableCell>{item.material?.unit}</TableCell>
                      <TableCell>{item.is_critical ? <Badge variant="destructive" className="text-xs">Kritik</Badge> : '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(recipe.id, item.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
