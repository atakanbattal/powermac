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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { MODEL_LABELS } from '@/lib/constants'
import type { Shipment } from '@/lib/types'
import { Plus, Truck, Loader2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { DateRangeFilter } from '@/components/date-range-filter'

interface Props {
  shipments: (Shipment & { gearbox?: { serial_number: string; model: string; status: string } | null })[]
  stockGearboxes: { id: string; serial_number: string; model: string }[]
  dateRangeStart: string
  dateRangeEnd: string
}

export function SevkiyatClient({ shipments: initShipments, stockGearboxes, dateRangeStart, dateRangeEnd }: Props) {
  const [shipments, setShipments] = useState(initShipments)
  const [shipOpen, setShipOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Çoklu seçim
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [shipForm, setShipForm] = useState({
    shipment_date: new Date().toISOString().split('T')[0],
    customer_name: '', delivery_address: '', waybill_number: '', invoice_number: '', notes: '',
  })
  const router = useRouter()
  const supabase = createClient()

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === stockGearboxes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(stockGearboxes.map(g => g.id)))
    }
  }

  const handleCreateShipment = async () => {
    if (selectedIds.size === 0) { toast.error('En az bir şanzıman seçin'); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const ids = Array.from(selectedIds)

      // Her seçili şanzıman için sevkiyat kaydı oluştur
      const rows = ids.map(gearbox_id => ({
        gearbox_id,
        shipment_date: shipForm.shipment_date,
        customer_name: shipForm.customer_name,
        delivery_address: shipForm.delivery_address,
        waybill_number: shipForm.waybill_number,
        invoice_number: shipForm.invoice_number,
        notes: shipForm.notes,
        shipped_by: user?.id,
      }))

      const { data, error } = await supabase
        .from('shipments')
        .insert(rows)
        .select('*, gearbox:gearboxes(serial_number, model, status)')
      if (error) throw error

      // Durumları güncelle
      for (const id of ids) {
        await supabase.from('gearboxes').update({ status: 'sevk_edildi' }).eq('id', id)
      }

      setShipments([...(data || []), ...shipments])
      setShipOpen(false)
      setSelectedIds(new Set())
      setShipForm({
        shipment_date: new Date().toISOString().split('T')[0],
        customer_name: '', delivery_address: '', waybill_number: '', invoice_number: '', notes: '',
      })
      toast.success(`${ids.length} şanzıman sevk edildi`)
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sevkiyat</h1>
          <p className="text-sm text-muted-foreground mt-1">Sevkiyat kayıtları ve takibi</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <DateRangeFilter start={dateRangeStart} end={dateRangeEnd} label="Sevk Tarihi" />

          <Dialog open={shipOpen} onOpenChange={v => { setShipOpen(v); if (!v) setSelectedIds(new Set()) }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Yeni Sevkiyat</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Yeni Sevkiyat</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Şanzıman Seçimi - Çoklu */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Şanzımanlar ({selectedIds.size} seçili)</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                      {selectedIds.size === stockGearboxes.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                    </Button>
                  </div>
                  {stockGearboxes.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 border rounded-lg text-center">Stoktaki şanzıman yok</p>
                  ) : (
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {stockGearboxes.map(g => (
                        <label
                          key={g.id}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                        >
                          <Checkbox
                            checked={selectedIds.has(g.id)}
                            onCheckedChange={() => toggleSelect(g.id)}
                          />
                          <span className="font-mono font-medium">{g.serial_number}</span>
                          <Badge variant="outline" className="ml-auto">{MODEL_LABELS[g.model as keyof typeof MODEL_LABELS]}</Badge>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Sevk Tarihi</Label><Input type="date" value={shipForm.shipment_date} onChange={e => setShipForm({ ...shipForm, shipment_date: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Müşteri</Label><Input value={shipForm.customer_name} onChange={e => setShipForm({ ...shipForm, customer_name: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>İrsaliye No</Label><Input value={shipForm.waybill_number} onChange={e => setShipForm({ ...shipForm, waybill_number: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Fatura No</Label><Input value={shipForm.invoice_number} onChange={e => setShipForm({ ...shipForm, invoice_number: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Teslimat Adresi</Label><Input value={shipForm.delivery_address} onChange={e => setShipForm({ ...shipForm, delivery_address: e.target.value })} /></div>
                <div className="space-y-2"><Label>Notlar</Label><Textarea value={shipForm.notes} onChange={e => setShipForm({ ...shipForm, notes: e.target.value })} /></div>

                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                    <Package className="w-4 h-4 shrink-0" />
                    <span><strong>{selectedIds.size}</strong> şanzıman sevk edilecek</span>
                  </div>
                )}

                <Button onClick={handleCreateShipment} disabled={loading || selectedIds.size === 0} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Truck className="w-4 h-4 mr-2" />}
                  {selectedIds.size > 0 ? `${selectedIds.size} Ürün Sevk Et` : 'Sevk Et'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sevkiyat Tablosu */}
      <Card>
        <CardHeader><CardTitle>Sevkiyat Kayıtları</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seri No</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Sevk Tarihi</TableHead>
                <TableHead>Müşteri</TableHead>
                <TableHead>İrsaliye No</TableHead>
                <TableHead>Fatura No</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Kayıt yok</TableCell></TableRow>
              ) : shipments.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono font-medium">{s.gearbox?.serial_number}</TableCell>
                  <TableCell><Badge variant="outline">{MODEL_LABELS[s.gearbox?.model as keyof typeof MODEL_LABELS] || '-'}</Badge></TableCell>
                  <TableCell>{new Date(s.shipment_date).toLocaleDateString('tr-TR')}</TableCell>
                  <TableCell>{s.customer_name || '-'}</TableCell>
                  <TableCell className="font-mono">{s.waybill_number || '-'}</TableCell>
                  <TableCell className="font-mono">{s.invoice_number || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
