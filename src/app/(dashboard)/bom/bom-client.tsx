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
import { getModelLabel } from '@/lib/constants'
import type { BomRevision, BomItem } from '@/lib/types'
import { Plus, FileText, Loader2, Trash2, AlertTriangle, Settings2, Pencil, Save, Search } from 'lucide-react'
import { toast } from 'sonner'
import { RecipeCard } from './recipe-card'

interface GearboxModelRow {
  id: string
  code: string
  name: string
  sort_order: number
}

interface BomClientProps {
  bomRevisions: (BomRevision & { bom_items: (BomItem & { material?: { code: string; name: string; unit: string } | null })[] })[]
  materials: { id: string; code: string; name: string; unit: string }[]
  gearboxModels: GearboxModelRow[]
}

export function BomClient({ bomRevisions: initRevs, materials, gearboxModels }: BomClientProps) {
  const [revisions, setRevisions] = useState(initRevs)
  const [models, setModels] = useState(gearboxModels)
  const [createOpen, setCreateOpen] = useState(false)
  const [addModelOpen, setAddModelOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedRevId, setSelectedRevId] = useState<string | null>(null)

  const [newRecipeModel, setNewRecipeModel] = useState<string>(models[0]?.code ?? 'A')
  const [newRecipeDesc, setNewRecipeDesc] = useState('')
  const [newModelCode, setNewModelCode] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [editModelOpen, setEditModelOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<GearboxModelRow | null>(null)
  const [editModelCode, setEditModelCode] = useState('')
  const [editModelName, setEditModelName] = useState('')
  const [itemForm, setItemForm] = useState({ material_id: '', quantity_per_unit: '1', is_critical: false })
  const [selectedModelForRecipe, setSelectedModelForRecipe] = useState<string>(models[0]?.code ?? '')
  const [selectedModelForMgmt, setSelectedModelForMgmt] = useState<string>('')
  const [materialSearch, setMaterialSearch] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Aktif reçeteler (model başına 1 tane)
  const activeRecipes = models.map(m => {
    const active = revisions.find(r => r.model === m.code && r.is_active)
    return { model: m.code, modelName: m.name, recipe: active }
  })

  const modelsWithoutBom = activeRecipes.filter(r => !r.recipe).map(r => r.model)

  const handleAddModel = async () => {
    const code = newModelCode.trim().toUpperCase()
    const name = newModelName.trim() || `Model ${code}`
    if (!code) {
      toast.error('Model kodu girin')
      return
    }
    if (models.some(m => m.code === code)) {
      toast.error('Bu model zaten mevcut')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.from('gearbox_models').insert({
        code,
        name,
        sort_order: models.length + 1,
      }).select().single()
      if (error) throw error
      setModels([...models, data])
      setAddModelOpen(false)
      setNewModelCode('')
      setNewModelName('')
      toast.success(`${name} eklendi`)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleCreateRecipe = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: newRevId, error: rpcError } = await supabase.rpc('create_bom_revision', {
        p_model: newRecipeModel,
        p_description: newRecipeDesc || `${getModelLabel(newRecipeModel, models)} reçetesi`,
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
      toast.success(`${getModelLabel(newRecipeModel, models)} reçetesi oluşturuldu`)
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

  const openEditModel = (m: GearboxModelRow) => {
    setEditingModel(m)
    setEditModelCode(m.code)
    setEditModelName(m.name)
    setEditModelOpen(true)
  }

  const handleUpdateModel = async () => {
    if (!editingModel) return
    const code = editModelCode.trim().toUpperCase()
    const name = editModelName.trim() || `Model ${code}`
    if (!code) {
      toast.error('Model kodu girin')
      return
    }
    if (models.some(m => m.code === code && m.id !== editingModel.id)) {
      toast.error('Bu model kodu zaten başka bir modelde kullanılıyor')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.from('gearbox_models').update({ code, name }).eq('id', editingModel.id)
      if (error) throw error
      setModels(models.map(m => m.id === editingModel.id ? { ...m, code, name } : m))
      setEditModelOpen(false)
      setEditingModel(null)
      toast.success('Model güncellendi')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleDeleteModel = async (m: GearboxModelRow) => {
    const hasBom = revisions.some(r => r.model === m.code)
    if (hasBom) {
      toast.error('Bu model için reçete tanımlı. Önce reçeteyi silmeniz veya başka modele taşımanız gerekir.')
      return
    }
    if (!confirm(`"${m.name}" modelini silmek istediğinize emin misiniz?`)) return
    setLoading(true)
    try {
      const { error } = await supabase.from('gearbox_models').update({ is_active: false }).eq('id', m.id)
      if (error) throw error
      setModels(models.filter(x => x.id !== m.id))
      toast.success('Model silindi')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BOM / Ürün Reçetesi</h1>
          <p className="text-sm text-muted-foreground mt-1">Her model için gerekli malzeme listesi</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Yeni Reçete</Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader><DialogTitle>Yeni Ürün Reçetesi</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={newRecipeModel} onValueChange={setNewRecipeModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {models.map(m => (
                      <SelectItem key={m.id} value={m.code}>{m.name}</SelectItem>
                    ))}
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
      </div>

      {/* Model Yönetimi - dropdown ile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4" />Model Yönetimi
          </CardTitle>
          <p className="text-sm text-muted-foreground">Model seçerek düzenleyebilir veya silebilirsiniz.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={selectedModelForMgmt || (models[0]?.id ?? '')} onValueChange={setSelectedModelForMgmt}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Model seçin" />
            </SelectTrigger>
            <SelectContent>
              {models.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name} ({m.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(selectedModelForMgmt || models[0]?.id) && (() => {
            const m = models.find(x => x.id === (selectedModelForMgmt || models[0]?.id))
            return m ? (
              <>
                <Button variant="outline" size="sm" onClick={() => openEditModel(m)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />Düzenle
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteModel(m)}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />Sil
                </Button>
              </>
            ) : null
          })()}
          <Dialog open={addModelOpen} onOpenChange={setAddModelOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm"><Plus className="w-3.5 h-3.5 mr-1" />Yeni Model</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Yeni Şanzıman Modeli</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Model Kodu</Label>
                  <Input value={newModelCode} onChange={e => setNewModelCode(e.target.value.toUpperCase())} placeholder="Örn: D, E" maxLength={5} />
                </div>
                <div className="space-y-2">
                  <Label>Model Adı</Label>
                  <Input value={newModelName} onChange={e => setNewModelName(e.target.value)} placeholder="Örn: Model D" />
                </div>
                <Button onClick={handleAddModel} disabled={loading || !newModelCode.trim()} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Model Ekle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Dialog open={editModelOpen} onOpenChange={setEditModelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Model Düzenle</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Model Kodu</Label>
              <Input value={editModelCode} onChange={e => setEditModelCode(e.target.value.toUpperCase())} placeholder="Örn: A, B" maxLength={5} />
            </div>
            <div className="space-y-2">
              <Label>Model Adı</Label>
              <Input value={editModelName} onChange={e => setEditModelName(e.target.value)} placeholder="Örn: Model A" />
            </div>
            <Button onClick={handleUpdateModel} disabled={loading || !editModelCode.trim()} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Güncelle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {modelsWithoutBom.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <strong>{modelsWithoutBom.map(m => getModelLabel(m, models)).join(', ')}</strong> için henüz reçete tanımlanmamış.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Malzeme Arama - Hangi ürünlerde kullanılıyor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" />Malzeme Kullanım Sorgulama
          </CardTitle>
          <p className="text-sm text-muted-foreground">Bir malzeme kodunu arayarak hangi modellerin reçetesinde kullanıldığını görün.</p>
        </CardHeader>
        <CardContent>
          <div className="relative w-80 mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Malzeme kodu veya adı ile ara..."
              value={materialSearch}
              onChange={e => setMaterialSearch(e.target.value)}
            />
          </div>
          {materialSearch.trim().length >= 2 && (() => {
            const q = materialSearch.toLowerCase()
            const matchedMaterials = materials.filter(m =>
              m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
            )
            if (matchedMaterials.length === 0) {
              return <p className="text-sm text-muted-foreground py-4">Eşleşen malzeme bulunamadı.</p>
            }
            return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Malzeme Kodu</TableHead>
                    <TableHead>Malzeme Adı</TableHead>
                    <TableHead>Kullanıldığı Modeller</TableHead>
                    <TableHead className="text-right">Adet/Birim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedMaterials.map(mat => {
                    const usedIn = revisions
                      .filter(r => r.is_active && r.bom_items.some(bi => bi.material_id === mat.id))
                      .map(r => ({
                        model: r.model,
                        modelName: getModelLabel(r.model, models),
                        qty: r.bom_items.find(bi => bi.material_id === mat.id)?.quantity_per_unit ?? 0,
                      }))
                    return (
                      <TableRow key={mat.id}>
                        <TableCell className="font-mono font-medium">{mat.code}</TableCell>
                        <TableCell>{mat.name}</TableCell>
                        <TableCell>
                          {usedIn.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Hiçbir reçetede kullanılmıyor</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {usedIn.map(u => (
                                <Badge key={u.model} variant="outline" className="text-xs">{u.modelName} ({u.qty} {mat.unit})</Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {usedIn.length > 0 ? usedIn.map(u => u.qty).join(' / ') : '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )
          })()}
        </CardContent>
      </Card>

      {/* Reçete görüntüle - dropdown ile */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Reçete görüntüle</Label>
          <Select value={selectedModelForRecipe} onValueChange={setSelectedModelForRecipe}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Model seçin" />
            </SelectTrigger>
            <SelectContent>
              {models.map(m => (
                <SelectItem key={m.id} value={m.code}>{m.name} ({m.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(() => {
            const item = activeRecipes.find(r => r.model === selectedModelForRecipe)
            const recipe = item?.recipe
            if (!recipe) {
              return (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{getModelLabel(selectedModelForRecipe, models)} için henüz reçete tanımlanmamış.</p>
                  <Button className="mt-3" onClick={() => { setNewRecipeModel(selectedModelForRecipe); setCreateOpen(true) }}>
                    <Plus className="w-4 h-4 mr-2" />Reçete Oluştur
                  </Button>
                </div>
              )
            }
            return (
              <RecipeCard
                key={recipe.id}
                modelName={item!.modelName}
                recipe={recipe}
                materials={materials}
                itemForm={itemForm}
                setItemForm={setItemForm}
                addItemOpen={addItemOpen}
                selectedRevId={selectedRevId}
                setAddItemOpen={setAddItemOpen}
                setSelectedRevId={setSelectedRevId}
                onAddItem={handleAddItem}
                onDeleteItem={handleDeleteItem}
                loading={loading}
              />
            )
          })()}
      </div>
    </div>
  )
}
