'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MODEL_LABELS } from '@/lib/constants'
import type { Gearbox, GearboxPartMapping, MaterialStockEntry, BomRevision, BomItem, Material } from '@/lib/types'
import { ArrowLeft, Package, Plus, Loader2, CheckCircle, AlertTriangle, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Props {
  gearbox: Gearbox & { bom_revision?: (BomRevision & { bom_items: (BomItem & { material?: Material | null })[] }) | null }
  existingMappings: (GearboxPartMapping & { material?: { code: string; name: string; unit: string } | null; stock_entry?: { id: string; invoice_number: string; lot_number: string; remaining_quantity: number; supplier?: { name: string } | null } | null })[]
  stockEntries: (MaterialStockEntry & { material?: { code: string; name: string; unit: string } | null; supplier?: { name: string } | null })[]
}

interface NewMapping {
  material_id: string
  stock_entry_id: string
  quantity: string
}

export function EslestirmeClient({ gearbox, existingMappings: initMappings, stockEntries }: Props) {
  const [mappings, setMappings] = useState(initMappings)
  const [newMapping, setNewMapping] = useState<NewMapping>({ material_id: '', stock_entry_id: '', quantity: '1' })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const bomItems = gearbox.bom_revision?.bom_items || []

  // Malzeme bazında gerekli ve eşleştirilmiş miktarları hesapla
  const materialNeeds = bomItems.map(bi => {
    const mapped = mappings.filter(m => m.material_id === bi.material_id).reduce((sum, m) => sum + m.quantity, 0)
    return { ...bi, mappedQty: mapped, needed: bi.quantity_per_unit, complete: mapped >= bi.quantity_per_unit }
  })

  const allComplete = materialNeeds.length > 0 && materialNeeds.every(m => m.complete)

  // Seçilen malzeme için uygun stok girişleri
  const filteredEntries = stockEntries.filter(e => e.material_id === newMapping.material_id && e.remaining_quantity > 0)

  const handleAddMapping = async () => {
    if (!newMapping.material_id || !newMapping.stock_entry_id) return
    setLoading(true)
    try {
      const qty = parseFloat(newMapping.quantity) || 1
      const entry = stockEntries.find(e => e.id === newMapping.stock_entry_id)
      if (entry && qty > entry.remaining_quantity) {
        throw new Error(`Stok yetersiz! Kalan: ${entry.remaining_quantity}`)
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('gearbox_part_mappings').insert({
        gearbox_id: gearbox.id,
        material_id: newMapping.material_id,
        stock_entry_id: newMapping.stock_entry_id,
        quantity: qty,
        mapped_by: user?.id,
      }).select('*, material:materials!material_id(code, name, unit), stock_entry:material_stock_entries(id, invoice_number, lot_number, remaining_quantity, supplier:suppliers(name))').single()
      if (error) throw error

      // Stok düş
      await supabase.from('material_stock_entries').update({
        remaining_quantity: (entry?.remaining_quantity || 0) - qty,
      }).eq('id', newMapping.stock_entry_id)

      // Stok hareketi
      await supabase.from('stock_movements').insert({
        material_id: newMapping.material_id,
        stock_entry_id: newMapping.stock_entry_id,
        gearbox_id: gearbox.id,
        movement_type: 'tuketim',
        quantity: qty,
        created_by: user?.id,
      })

      await supabase.rpc('update_material_stock', { p_material_id: newMapping.material_id, p_quantity: qty, p_movement_type: 'tuketim' })

      setMappings([...mappings, data])
      setNewMapping({ material_id: '', stock_entry_id: '', quantity: '1' })
      toast.success('Parça eşleştirildi')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleComplete = async () => {
    await supabase.from('gearboxes').update({ parts_mapping_complete: true }).eq('id', gearbox.id)
    toast.success('Parça eşleştirme tamamlandı!')
    router.push(`/uretim/${gearbox.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/uretim/${gearbox.id}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> Şanzıman Detay
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Parça Eşleştirme</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="font-mono">{gearbox.serial_number}</Badge>
              <Badge variant="outline">{MODEL_LABELS[gearbox.model]}</Badge>
              {gearbox.bom_revision && <Badge variant="secondary">BOM Rev {gearbox.bom_revision.revision_no}</Badge>}
            </div>
          </div>
          <Button onClick={handleComplete} disabled={!allComplete}>
            <CheckCircle className="w-4 h-4 mr-2" />Eşleştirmeyi Tamamla
          </Button>
        </div>
      </div>

      {/* BOM İhtiyaç Listesi */}
      {bomItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle>BOM İhtiyaç Listesi (Kitting)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Malzeme</TableHead>
                  <TableHead className="text-right">Gerekli</TableHead>
                  <TableHead className="text-right">Eşleştirildi</TableHead>
                  <TableHead className="text-right">Mevcut Stok</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialNeeds.map(need => (
                  <TableRow key={need.id} className={!need.complete ? 'bg-amber-50' : ''}>
                    <TableCell>
                      <span className="font-mono">{need.material?.code}</span> - {need.material?.name}
                    </TableCell>
                    <TableCell className="text-right font-bold">{need.needed}</TableCell>
                    <TableCell className="text-right font-bold">{need.mappedQty}</TableCell>
                    <TableCell className="text-right">{need.material?.current_stock || 0}</TableCell>
                    <TableCell>
                      {need.complete ? (
                        <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="w-3 h-3 mr-1" />Tamam</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700"><AlertTriangle className="w-3 h-3 mr-1" />Eksik</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Eşleştirme Formu */}
      <Card>
        <CardHeader><CardTitle>Parça Ekle</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Malzeme</Label>
              <Select value={newMapping.material_id} onValueChange={v => setNewMapping({...newMapping, material_id: v, stock_entry_id: ''})}>
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  {[...new Map(stockEntries.map(e => [e.material_id, e])).values()].map(e => (
                    <SelectItem key={e.material_id} value={e.material_id}>{e.material?.code} - {e.material?.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stok Girişi (İrsaliye/Lot)</Label>
              <Select value={newMapping.stock_entry_id} onValueChange={v => setNewMapping({...newMapping, stock_entry_id: v})}>
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  {filteredEntries.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.invoice_number || 'N/A'} / {e.lot_number || 'N/A'} (Kalan: {e.remaining_quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Miktar</Label>
              <Input type="number" value={newMapping.quantity} onChange={e => setNewMapping({...newMapping, quantity: e.target.value})} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddMapping} disabled={loading || !newMapping.material_id || !newMapping.stock_entry_id} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Ekle
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eşleştirilmiş Parçalar */}
      <Card>
        <CardHeader><CardTitle>Eşleştirilmiş Parçalar ({mappings.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Malzeme Kodu</TableHead>
                <TableHead>Adı</TableHead>
                <TableHead>İrsaliye</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Henüz eşleştirme yok</TableCell></TableRow>
              ) : mappings.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono">{m.material?.code}</TableCell>
                  <TableCell className="font-medium">{m.material?.name}</TableCell>
                  <TableCell className="font-mono text-sm">{m.stock_entry?.invoice_number || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{m.stock_entry?.lot_number || '-'}</TableCell>
                  <TableCell>{m.stock_entry?.supplier?.name || '-'}</TableCell>
                  <TableCell className="text-right font-bold">{m.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
