'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Loader2, Trash2 } from 'lucide-react'

interface RecipeCardProps {
  modelName: string
  recipe: { id: string; description?: string; bom_items: { id: string; material_id?: string; material?: { code: string; name: string; unit: string } | null; quantity_per_unit: number; is_critical: boolean }[] }
  materials: { id: string; code: string; name: string; unit: string }[]
  itemForm: { material_id: string; quantity_per_unit: string; is_critical: boolean }
  setItemForm: (f: { material_id: string; quantity_per_unit: string; is_critical: boolean }) => void
  addItemOpen: boolean
  selectedRevId: string | null
  setAddItemOpen: (v: boolean) => void
  setSelectedRevId: (id: string | null) => void
  onAddItem: () => void
  onDeleteItem: (revId: string, itemId: string) => void
  loading: boolean
}

export function RecipeCard({
  modelName,
  recipe,
  materials,
  itemForm,
  setItemForm,
  addItemOpen,
  selectedRevId,
  setAddItemOpen,
  setSelectedRevId,
  onAddItem,
  onDeleteItem,
  loading,
}: RecipeCardProps) {
  return (
    <Card key={recipe.id}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-base">{modelName} Reçetesi</CardTitle>
            <p className="text-xs text-muted-foreground">{recipe.description || ''} - {recipe.bom_items.length} malzeme</p>
          </div>
        </div>
        <Dialog open={addItemOpen && selectedRevId === recipe.id} onOpenChange={(v) => { setAddItemOpen(v); if (v) setSelectedRevId(recipe.id) }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="w-3 h-3 mr-1" />Malzeme Ekle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{modelName} - Malzeme Ekle</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Malzeme</Label>
                <Select value={itemForm.material_id} onValueChange={(v) => setItemForm({ ...itemForm, material_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Malzeme seçin" /></SelectTrigger>
                  <SelectContent>
                    {materials.filter((m) => !recipe.bom_items.some((bi) => (bi as { material_id?: string }).material_id === m.id)).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.code} - {m.name} ({m.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Adet / Miktar (1 şanzıman için)</Label>
                <Input type="number" step="0.001" min="0.001" value={itemForm.quantity_per_unit} onChange={(e) => setItemForm({ ...itemForm, quantity_per_unit: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="critical-bom" checked={itemForm.is_critical} onCheckedChange={(c) => setItemForm({ ...itemForm, is_critical: !!c })} />
                <Label htmlFor="critical-bom" className="text-sm cursor-pointer">Kritik malzeme</Label>
              </div>
              <Button onClick={onAddItem} disabled={loading || !itemForm.material_id} className="w-full">
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
            ) : recipe.bom_items.map((bi) => (
              <TableRow key={bi.id}>
                <TableCell className="font-mono">{bi.material?.code}</TableCell>
                <TableCell className="font-medium">{bi.material?.name}</TableCell>
                <TableCell className="text-right font-bold">{bi.quantity_per_unit}</TableCell>
                <TableCell>{bi.material?.unit}</TableCell>
                <TableCell>{bi.is_critical ? <Badge variant="destructive" className="text-xs">Kritik</Badge> : '-'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => onDeleteItem(recipe.id, bi.id)}>
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
}
