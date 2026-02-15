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
import type { ControlPlanRevision, ControlPlanItem, GearboxModel } from '@/lib/types'
import { Plus, ClipboardList, Loader2, Trash2, Star } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  plans: (ControlPlanRevision & { control_plan_items: ControlPlanItem[] })[]
}

export function KontrolPlaniClient({ plans: initPlans }: Props) {
  const [plans, setPlans] = useState(initPlans)
  const [planOpen, setPlanOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [newModel, setNewModel] = useState<GearboxModel>('A')
  const [newDesc, setNewDesc] = useState('')
  const [itemForm, setItemForm] = useState({
    name: '', characteristic: '', nominal_value: '', lower_limit: '', upper_limit: '',
    unit: 'mm', measurement_method: '', equipment: '', is_critical: false, is_100_percent: true,
  })
  const router = useRouter()
  const supabase = createClient()

  const handleCreatePlan = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const maxRev = plans.filter(p => p.model === newModel).reduce((max, p) => Math.max(max, p.revision_no), 0)
      await supabase.from('control_plan_revisions').update({ is_active: false }).eq('model', newModel).eq('is_active', true)

      const { data, error } = await supabase.from('control_plan_revisions').insert({
        model: newModel, revision_no: maxRev + 1, description: newDesc,
        is_active: true, created_by: user?.id,
      }).select('*, control_plan_items(*)').single()
      if (error) throw error

      setPlans([data, ...plans.map(p => p.model === newModel ? { ...p, is_active: false } : p)])
      setPlanOpen(false)
      toast.success('Kontrol planı oluşturuldu')
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleAddItem = async () => {
    if (!selectedPlanId || !itemForm.name) return
    setLoading(true)
    try {
      const { data, error } = await supabase.from('control_plan_items').insert({
        control_plan_id: selectedPlanId,
        name: itemForm.name,
        characteristic: itemForm.characteristic,
        nominal_value: itemForm.nominal_value ? parseFloat(itemForm.nominal_value) : null,
        lower_limit: itemForm.lower_limit ? parseFloat(itemForm.lower_limit) : null,
        upper_limit: itemForm.upper_limit ? parseFloat(itemForm.upper_limit) : null,
        unit: itemForm.unit,
        measurement_method: itemForm.measurement_method,
        equipment: itemForm.equipment,
        is_critical: itemForm.is_critical,
        is_100_percent: itemForm.is_100_percent,
      }).select('*').single()
      if (error) throw error

      setPlans(plans.map(p => p.id === selectedPlanId ? { ...p, control_plan_items: [...p.control_plan_items, data] } : p))
      setItemOpen(false)
      setItemForm({ name: '', characteristic: '', nominal_value: '', lower_limit: '', upper_limit: '', unit: 'mm', measurement_method: '', equipment: '', is_critical: false, is_100_percent: true })
      toast.success('Ölçüm satırı eklendi')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleDeleteItem = async (planId: string, itemId: string) => {
    await supabase.from('control_plan_items').delete().eq('id', itemId)
    setPlans(plans.map(p => p.id === planId ? { ...p, control_plan_items: p.control_plan_items.filter(i => i.id !== itemId) } : p))
    toast.success('Satır silindi')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kontrol Planları</h1>
          <p className="text-sm text-muted-foreground mt-1">Model bazlı final kontrol ölçüm planları</p>
        </div>
        <Dialog open={planOpen} onOpenChange={setPlanOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Yeni Plan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yeni Kontrol Planı</DialogTitle></DialogHeader>
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
                <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              </div>
              <Button onClick={handleCreatePlan} disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Plan Oluştur
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {plans.map(plan => (
        <Card key={plan.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base">{MODEL_LABELS[plan.model]} - Rev {plan.revision_no}</CardTitle>
                <p className="text-xs text-muted-foreground">{plan.description || ''} &bull; {new Date(plan.effective_date).toLocaleDateString('tr-TR')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {plan.is_active && <Badge className="bg-emerald-100 text-emerald-700">Aktif</Badge>}
              <Dialog open={itemOpen && selectedPlanId === plan.id} onOpenChange={v => { setItemOpen(v); if (v) setSelectedPlanId(plan.id) }}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-3 h-3 mr-1" />Ölçüm Ekle</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Ölçüm Satırı Ekle</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Ölçüm Adı</Label><Input value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Mil Çapı" /></div>
                      <div className="space-y-2"><Label>Karakteristik</Label><Input value={itemForm.characteristic} onChange={e => setItemForm({...itemForm, characteristic: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2"><Label>Nominal</Label><Input type="number" step="0.001" value={itemForm.nominal_value} onChange={e => setItemForm({...itemForm, nominal_value: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Alt Limit</Label><Input type="number" step="0.001" value={itemForm.lower_limit} onChange={e => setItemForm({...itemForm, lower_limit: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Üst Limit</Label><Input type="number" step="0.001" value={itemForm.upper_limit} onChange={e => setItemForm({...itemForm, upper_limit: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Birim</Label><Input value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Yöntem/Ekipman</Label><Input value={itemForm.measurement_method} onChange={e => setItemForm({...itemForm, measurement_method: e.target.value})} /></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox id="critical" checked={itemForm.is_critical} onCheckedChange={v => setItemForm({...itemForm, is_critical: v as boolean})} />
                        <Label htmlFor="critical" className="text-sm">Kritik Karakteristik</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="pct100" checked={itemForm.is_100_percent} onCheckedChange={v => setItemForm({...itemForm, is_100_percent: v as boolean})} />
                        <Label htmlFor="pct100" className="text-sm">%100 Kontrol</Label>
                      </div>
                    </div>
                    <Button onClick={handleAddItem} disabled={loading || !itemForm.name} className="w-full">
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
                  <TableHead></TableHead>
                  <TableHead>Ölçüm Adı</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Alt Limit</TableHead>
                  <TableHead>Üst Limit</TableHead>
                  <TableHead>Birim</TableHead>
                  <TableHead>Yöntem</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plan.control_plan_items.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Henüz ölçüm tanımlanmadı</TableCell></TableRow>
                ) : plan.control_plan_items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.is_critical && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono">{item.nominal_value ?? '-'}</TableCell>
                    <TableCell className="font-mono">{item.lower_limit ?? '-'}</TableCell>
                    <TableCell className="font-mono">{item.upper_limit ?? '-'}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.measurement_method || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(plan.id, item.id)}>
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
