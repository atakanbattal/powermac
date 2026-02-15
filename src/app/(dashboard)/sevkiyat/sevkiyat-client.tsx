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
import { MODEL_LABELS } from '@/lib/constants'
import type { Shipment, Gearbox } from '@/lib/types'
import { Plus, Truck, Car, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  shipments: (Shipment & { gearbox?: { serial_number: string; model: string; status: string } | null })[]
  stockGearboxes: { id: string; serial_number: string; model: string }[]
  shippedGearboxes: { id: string; serial_number: string; model: string }[]
}

export function SevkiyatClient({ shipments: initShipments, stockGearboxes, shippedGearboxes }: Props) {
  const [shipments, setShipments] = useState(initShipments)
  const [shipOpen, setShipOpen] = useState(false)
  const [mountOpen, setMountOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shipForm, setShipForm] = useState({ gearbox_id: '', shipment_date: new Date().toISOString().split('T')[0], customer_name: '', delivery_address: '', waybill_number: '', invoice_number: '', notes: '' })
  const [mountForm, setMountForm] = useState({ gearbox_id: '', assembly_date: new Date().toISOString().split('T')[0], vehicle_plate: '', vin_number: '', customer_name: '', notes: '' })
  const router = useRouter()
  const supabase = createClient()

  const handleCreateShipment = async () => {
    setLoading(true)
    try {
      if (!shipForm.gearbox_id) throw new Error('Şanzıman seçin')
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('shipments').insert({
        ...shipForm,
        shipped_by: user?.id,
      }).select('*, gearbox:gearboxes(serial_number, model, status)').single()
      if (error) throw error

      // Durumu güncelle
      await supabase.from('gearboxes').update({ status: 'sevk_edildi' }).eq('id', shipForm.gearbox_id)

      setShipments([data, ...shipments])
      setShipOpen(false)
      setShipForm({ gearbox_id: '', shipment_date: new Date().toISOString().split('T')[0], customer_name: '', delivery_address: '', waybill_number: '', invoice_number: '', notes: '' })
      toast.success('Sevkiyat kaydedildi')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleCreateMount = async () => {
    setLoading(true)
    try {
      if (!mountForm.gearbox_id) throw new Error('Şanzıman seçin')
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('vehicle_assemblies').insert({
        ...mountForm,
        recorded_by: user?.id,
      })
      await supabase.from('gearboxes').update({ status: 'montajlandi' }).eq('id', mountForm.gearbox_id)
      setMountOpen(false)
      setMountForm({ gearbox_id: '', assembly_date: new Date().toISOString().split('T')[0], vehicle_plate: '', vin_number: '', customer_name: '', notes: '' })
      toast.success('Montaj bilgisi kaydedildi')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sevkiyat & Montaj</h1>
          <p className="text-sm text-muted-foreground mt-1">Sevkiyat ve araç montaj bilgileri</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={mountOpen} onOpenChange={setMountOpen}>
            <DialogTrigger asChild><Button variant="outline"><Car className="w-4 h-4 mr-2" />Montaj Bilgisi</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Araç Montaj Bilgisi</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Şanzıman</Label>
                  <Select value={mountForm.gearbox_id} onValueChange={v => setMountForm({...mountForm, gearbox_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Sevk edilmiş şanzıman seçin" /></SelectTrigger>
                    <SelectContent>
                      {shippedGearboxes.map(g => <SelectItem key={g.id} value={g.id}>{g.serial_number} ({MODEL_LABELS[g.model as keyof typeof MODEL_LABELS]})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Montaj Tarihi</Label><Input type="date" value={mountForm.assembly_date} onChange={e => setMountForm({...mountForm, assembly_date: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Müşteri</Label><Input value={mountForm.customer_name} onChange={e => setMountForm({...mountForm, customer_name: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Araç Plakası</Label><Input value={mountForm.vehicle_plate} onChange={e => setMountForm({...mountForm, vehicle_plate: e.target.value})} placeholder="34 ABC 123" /></div>
                  <div className="space-y-2"><Label>VIN / Şase No</Label><Input value={mountForm.vin_number} onChange={e => setMountForm({...mountForm, vin_number: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><Label>Notlar</Label><Textarea value={mountForm.notes} onChange={e => setMountForm({...mountForm, notes: e.target.value})} /></div>
                <Button onClick={handleCreateMount} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Car className="w-4 h-4 mr-2" />}Montaj Kaydet
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={shipOpen} onOpenChange={setShipOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Yeni Sevkiyat</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Yeni Sevkiyat</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Şanzıman</Label>
                  <Select value={shipForm.gearbox_id} onValueChange={v => setShipForm({...shipForm, gearbox_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Stoktaki şanzıman seçin" /></SelectTrigger>
                    <SelectContent>
                      {stockGearboxes.map(g => <SelectItem key={g.id} value={g.id}>{g.serial_number} ({MODEL_LABELS[g.model as keyof typeof MODEL_LABELS]})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Sevk Tarihi</Label><Input type="date" value={shipForm.shipment_date} onChange={e => setShipForm({...shipForm, shipment_date: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Müşteri</Label><Input value={shipForm.customer_name} onChange={e => setShipForm({...shipForm, customer_name: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>İrsaliye No</Label><Input value={shipForm.waybill_number} onChange={e => setShipForm({...shipForm, waybill_number: e.target.value})} /></div>
                  <div className="space-y-2"><Label>Fatura No</Label><Input value={shipForm.invoice_number} onChange={e => setShipForm({...shipForm, invoice_number: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><Label>Teslimat Adresi</Label><Input value={shipForm.delivery_address} onChange={e => setShipForm({...shipForm, delivery_address: e.target.value})} /></div>
                <div className="space-y-2"><Label>Notlar</Label><Textarea value={shipForm.notes} onChange={e => setShipForm({...shipForm, notes: e.target.value})} /></div>
                <Button onClick={handleCreateShipment} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Truck className="w-4 h-4 mr-2" />}Sevk Et
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
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
