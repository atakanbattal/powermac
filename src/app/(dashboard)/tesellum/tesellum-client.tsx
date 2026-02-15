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
import { Textarea } from '@/components/ui/textarea'
import { Plus, Receipt, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'

interface MaterialRow {
  id: string
  code: string
  name: string
  unit: string
}

interface SupplierRow {
  id: string
  name: string
}

interface MaterialReceipt {
  id: string
  material_id: string
  supplier_id?: string
  invoice_number?: string
  lot_number?: string
  quantity: number
  receipt_date: string
  status: string
  material?: { code: string; name: string; unit: string } | null
  supplier?: { name: string } | null
}

interface TesellumClientProps {
  materials: MaterialRow[]
  suppliers: SupplierRow[]
  receipts: MaterialReceipt[]
}

const emptyReceiptForm = {
  material_id: '',
  supplier_id: '',
  invoice_number: '',
  lot_number: '',
  quantity: '',
  receipt_date: new Date().toISOString().split('T')[0],
  notes: '',
}

export function TesellumClient({ materials, suppliers, receipts: initReceipts }: TesellumClientProps) {
  const [receipts, setReceipts] = useState(initReceipts)
  const [tesellumOpen, setTesellumOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [receiptForm, setReceiptForm] = useState(emptyReceiptForm)
  const router = useRouter()
  const supabase = createClient()

  const handleCreateReceipt = async () => {
    setLoading(true)
    try {
      const qty = parseFloat(receiptForm.quantity)
      if (!qty || qty <= 0) throw new Error('Geçersiz miktar')
      if (!receiptForm.material_id) throw new Error('Malzeme seçin')

      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase.from('material_receipts').insert({
        material_id: receiptForm.material_id,
        supplier_id: receiptForm.supplier_id || null,
        invoice_number: receiptForm.invoice_number || null,
        lot_number: receiptForm.lot_number || null,
        quantity: qty,
        receipt_date: receiptForm.receipt_date,
        received_by: user?.id,
        status: 'teslim_alindi',
        notes: receiptForm.notes || null,
      }).select('*, material:materials(code, name, unit), supplier:suppliers(name)').single()
      if (error) throw error

      setReceipts([data, ...receipts])
      setTesellumOpen(false)
      setReceiptForm(emptyReceiptForm)
      toast.success('Tesellüm kaydı oluşturuldu. Girdi Kontrol sayfasından kalite kontrolü yapabilirsiniz.')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const pendingReceipts = receipts.filter(r => r.status === 'teslim_alindi' || r.status === 'kontrol_bekliyor')
  const filteredPending = pendingReceipts.filter(r => {
    const mat = r.material
    const code = mat?.code?.toLowerCase() ?? ''
    const name = mat?.name?.toLowerCase() ?? ''
    const q = search.toLowerCase()
    return !q || code.includes(q) || name.includes(q)
  })

  const allReceipts = receipts.filter(r => {
    const mat = r.material
    const code = mat?.code?.toLowerCase() ?? ''
    const name = mat?.name?.toLowerCase() ?? ''
    const q = search.toLowerCase()
    return !q || code.includes(q) || name.includes(q)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tesellüm</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Malzeme teslim alma. Tesellüme alınan malzemeler Girdi Kontrol sayfasından kalite kontrolüne gönderilir.
          </p>
        </div>
        <Dialog open={tesellumOpen} onOpenChange={setTesellumOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Tesellüm Girişi</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Malzeme Teslim Alma (Tesellüm)</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Malzemeler önce tesellüme alınır. Girdi Kontrol sayfasından kalite kontrolü yapıldıktan sonra stoğa geçer.
            </p>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Malzeme</Label>
                <Select value={receiptForm.material_id} onValueChange={v => setReceiptForm({ ...receiptForm, material_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Malzeme seçin" /></SelectTrigger>
                  <SelectContent>
                    {materials.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tedarikçi</Label>
                  <Select value={receiptForm.supplier_id} onValueChange={v => setReceiptForm({ ...receiptForm, supplier_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Miktar</Label>
                  <Input type="number" value={receiptForm.quantity} onChange={e => setReceiptForm({ ...receiptForm, quantity: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>İrsaliye No</Label>
                  <Input value={receiptForm.invoice_number} onChange={e => setReceiptForm({ ...receiptForm, invoice_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Lot / Seri No</Label>
                  <Input value={receiptForm.lot_number} onChange={e => setReceiptForm({ ...receiptForm, lot_number: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Teslim Tarihi</Label>
                <Input type="date" value={receiptForm.receipt_date} onChange={e => setReceiptForm({ ...receiptForm, receipt_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notlar</Label>
                <Textarea value={receiptForm.notes} onChange={e => setReceiptForm({ ...receiptForm, notes: e.target.value })} />
              </div>
              <Button onClick={handleCreateReceipt} disabled={loading || !receiptForm.material_id || !receiptForm.quantity} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Tesellüm Kaydet
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tesellüm Bekleyenler - Girdi Kontrole Gidecek */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Girdi Kontrole Gidecek Malzemeler
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tesellüme alınan malzemeler. Girdi Kontrol sayfasından kalite kontrolü başlatın.
          </p>
          <div className="relative w-72 mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Malzeme ara..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Malzeme</TableHead>
                <TableHead>İrsaliye / Lot</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Tesellüm bekleyen malzeme yok. Yukarıdaki &quot;Tesellüm Girişi&quot; ile yeni kayıt ekleyin.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPending.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.receipt_date).toLocaleDateString('tr-TR')}</TableCell>
                    <TableCell className="font-medium">{r.material?.code} - {r.material?.name}</TableCell>
                    <TableCell className="font-mono text-sm">{r.invoice_number || '-'} / {r.lot_number || '-'}</TableCell>
                    <TableCell>{r.supplier?.name || '-'}</TableCell>
                    <TableCell className="text-right font-bold">{r.quantity} {r.material?.unit}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Girdi Kontrol Bekliyor</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tüm Tesellüm Kayıtları */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tüm Tesellüm Kayıtları</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Malzeme</TableHead>
                <TableHead>İrsaliye / Lot</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allReceipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Kayıt yok</TableCell>
                </TableRow>
              ) : (
                allReceipts.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.receipt_date).toLocaleDateString('tr-TR')}</TableCell>
                    <TableCell className="font-medium">{r.material?.code} - {r.material?.name}</TableCell>
                    <TableCell className="font-mono text-sm">{r.invoice_number || '-'} / {r.lot_number || '-'}</TableCell>
                    <TableCell>{r.supplier?.name || '-'}</TableCell>
                    <TableCell className="text-right font-bold">{r.quantity} {r.material?.unit}</TableCell>
                    <TableCell>
                      {r.status === 'onaylandi' && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Onaylandı</Badge>}
                      {r.status === 'reddedildi' && <Badge variant="destructive">Reddedildi</Badge>}
                      {(r.status === 'teslim_alindi' || r.status === 'kontrol_bekliyor') && (
                        <Badge variant="secondary">Girdi Kontrol Bekliyor</Badge>
                      )}
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
