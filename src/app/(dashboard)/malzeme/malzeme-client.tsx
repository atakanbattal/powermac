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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { CATEGORY_LABELS } from '@/lib/constants'
import type { Material, Supplier, MaterialStockEntry, MaterialCategory, MaterialUnit } from '@/lib/types'
import { Plus, Package, Search, Loader2, Warehouse, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface MalzemeClientProps {
  materials: (Material & { default_supplier?: { name: string } | null })[]
  suppliers: Supplier[]
  stockEntries: (MaterialStockEntry & { material?: { code: string; name: string; unit: string } | null; supplier?: { name: string } | null })[]
}

export function MalzemeClient({ materials: initMaterials, suppliers, stockEntries: initEntries }: MalzemeClientProps) {
  const [materials, setMaterials] = useState(initMaterials)
  const [stockEntries, setStockEntries] = useState(initEntries)
  const [matOpen, setMatOpen] = useState(false)
  const [entryOpen, setEntryOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // Yeni malzeme formu
  const [matForm, setMatForm] = useState({ code: '', name: '', description: '', category: 'komponent' as MaterialCategory, unit: 'adet' as MaterialUnit, min_stock: '0', target_stock: '0' })

  // Yeni stok girişi formu
  const [entryForm, setEntryForm] = useState({ material_id: '', supplier_id: '', invoice_number: '', lot_number: '', quantity: '', entry_date: new Date().toISOString().split('T')[0], notes: '' })

  const handleCreateMaterial = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('materials').insert({
        ...matForm,
        min_stock: parseFloat(matForm.min_stock) || 0,
        target_stock: parseFloat(matForm.target_stock) || 0,
      }).select('*, default_supplier:suppliers(name)').single()
      if (error) throw error
      setMaterials([data, ...materials])
      setMatOpen(false)
      setMatForm({ code: '', name: '', description: '', category: 'komponent', unit: 'adet', min_stock: '0', target_stock: '0' })
      toast.success('Malzeme oluşturuldu')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata oluştu')
    } finally { setLoading(false) }
  }

  const handleCreateEntry = async () => {
    setLoading(true)
    try {
      const qty = parseFloat(entryForm.quantity)
      if (!qty || qty <= 0) throw new Error('Geçersiz miktar')
      if (!entryForm.material_id) throw new Error('Malzeme seçin')

      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase.from('material_stock_entries').insert({
        material_id: entryForm.material_id,
        supplier_id: entryForm.supplier_id || null,
        invoice_number: entryForm.invoice_number,
        lot_number: entryForm.lot_number,
        quantity: qty,
        remaining_quantity: qty,
        entry_date: entryForm.entry_date,
        notes: entryForm.notes,
        created_by: user?.id,
      }).select('*, material:materials(code, name, unit), supplier:suppliers(name)').single()
      if (error) throw error

      // Stok güncelle
      await supabase.rpc('update_material_stock', { p_material_id: entryForm.material_id, p_quantity: qty, p_movement_type: 'giris' })

      // Stok hareketi kaydet
      await supabase.from('stock_movements').insert({
        material_id: entryForm.material_id,
        stock_entry_id: data.id,
        movement_type: 'giris',
        quantity: qty,
        notes: `İrsaliye: ${entryForm.invoice_number}, Lot: ${entryForm.lot_number}`,
        created_by: user?.id,
      })

      setStockEntries([data, ...stockEntries])
      setEntryOpen(false)
      setEntryForm({ material_id: '', supplier_id: '', invoice_number: '', lot_number: '', quantity: '', entry_date: new Date().toISOString().split('T')[0], notes: '' })
      toast.success('Stok girişi kaydedildi')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata oluştu')
    } finally { setLoading(false) }
  }

  const filteredMaterials = materials.filter(m =>
    m.code.toLowerCase().includes(search.toLowerCase()) ||
    m.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Malzeme & Stok</h1>
          <p className="text-sm text-muted-foreground mt-1">Malzeme tanımları ve stok giriş yönetimi</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={matOpen} onOpenChange={setMatOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="w-4 h-4 mr-2" />Yeni Malzeme</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Yeni Malzeme Tanımı</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Malzeme Kodu</Label>
                    <Input value={matForm.code} onChange={e => setMatForm({...matForm, code: e.target.value})} placeholder="BEARING-X55" />
                  </div>
                  <div className="space-y-2">
                    <Label>Adı</Label>
                    <Input value={matForm.name} onChange={e => setMatForm({...matForm, name: e.target.value})} placeholder="Rulman" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kategori</Label>
                    <Select value={matForm.category} onValueChange={v => setMatForm({...matForm, category: v as MaterialCategory})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Birim</Label>
                    <Select value={matForm.unit} onValueChange={v => setMatForm({...matForm, unit: v as MaterialUnit})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['adet','kg','lt','m','mm','set'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Min Stok</Label>
                    <Input type="number" value={matForm.min_stock} onChange={e => setMatForm({...matForm, min_stock: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hedef Stok</Label>
                    <Input type="number" value={matForm.target_stock} onChange={e => setMatForm({...matForm, target_stock: e.target.value})} />
                  </div>
                </div>
                <Button onClick={handleCreateMaterial} disabled={loading || !matForm.code || !matForm.name} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Malzeme Oluştur
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Stok Girişi</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Yeni Stok Girişi</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Malzeme</Label>
                  <Select value={entryForm.material_id} onValueChange={v => setEntryForm({...entryForm, material_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Malzeme seçin" /></SelectTrigger>
                    <SelectContent>
                      {materials.map(m => <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tedarikçi</Label>
                    <Select value={entryForm.supplier_id} onValueChange={v => setEntryForm({...entryForm, supplier_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Miktar</Label>
                    <Input type="number" value={entryForm.quantity} onChange={e => setEntryForm({...entryForm, quantity: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>İrsaliye No</Label>
                    <Input value={entryForm.invoice_number} onChange={e => setEntryForm({...entryForm, invoice_number: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Lot / Seri No</Label>
                    <Input value={entryForm.lot_number} onChange={e => setEntryForm({...entryForm, lot_number: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Giriş Tarihi</Label>
                  <Input type="date" value={entryForm.entry_date} onChange={e => setEntryForm({...entryForm, entry_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Notlar</Label>
                  <Textarea value={entryForm.notes} onChange={e => setEntryForm({...entryForm, notes: e.target.value})} />
                </div>
                <Button onClick={handleCreateEntry} disabled={loading || !entryForm.material_id || !entryForm.quantity} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Stok Girişi Kaydet
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials"><Package className="w-4 h-4 mr-1" />Malzemeler</TabsTrigger>
          <TabsTrigger value="entries"><Warehouse className="w-4 h-4 mr-1" />Stok Girişleri</TabsTrigger>
        </TabsList>

        <TabsContent value="materials">
          <Card>
            <CardHeader>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Malzeme ara..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>Adı</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Birim</TableHead>
                    <TableHead className="text-right">Mevcut Stok</TableHead>
                    <TableHead className="text-right">Min Stok</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono font-medium">{m.code}</TableCell>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell><Badge variant="outline">{CATEGORY_LABELS[m.category]}</Badge></TableCell>
                      <TableCell>{m.unit}</TableCell>
                      <TableCell className={`text-right font-bold ${m.current_stock <= m.min_stock && m.min_stock > 0 ? 'text-red-600' : ''}`}>{m.current_stock}</TableCell>
                      <TableCell className="text-right">{m.min_stock}</TableCell>
                      <TableCell>
                        {m.current_stock <= m.min_stock && m.min_stock > 0 ? (
                          <Badge variant="destructive" className="text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Kritik</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Yeterli</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>İrsaliye No</TableHead>
                    <TableHead>Malzeme</TableHead>
                    <TableHead>Tedarikçi</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead className="text-right">Miktar</TableHead>
                    <TableHead className="text-right">Kalan</TableHead>
                    <TableHead>Giriş Tarihi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockEntries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono">{e.invoice_number || '-'}</TableCell>
                      <TableCell className="font-medium">{e.material?.code} - {e.material?.name}</TableCell>
                      <TableCell>{e.supplier?.name || '-'}</TableCell>
                      <TableCell className="font-mono">{e.lot_number || '-'}</TableCell>
                      <TableCell className="text-right font-bold">{e.quantity} {e.material?.unit}</TableCell>
                      <TableCell className="text-right">{e.remaining_quantity}</TableCell>
                      <TableCell>{new Date(e.entry_date).toLocaleDateString('tr-TR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
