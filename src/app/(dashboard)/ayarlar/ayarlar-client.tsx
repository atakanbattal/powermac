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
import { ROLE_LABELS } from '@/lib/constants'
import type { SystemSetting, Profile, Supplier, UserRole } from '@/lib/types'
import { Settings, Users, Building2, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  settings: SystemSetting[]
  profiles: Profile[]
  suppliers: Supplier[]
}

export function AyarlarClient({ settings, profiles: initProfiles, suppliers: initSuppliers }: Props) {
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [supplierForm, setSupplierForm] = useState({ name: '', code: '', phone: '', email: '' })
  const [suppliers, setSuppliers] = useState(initSuppliers)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleAddSupplier = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('suppliers').insert(supplierForm).select().single()
      if (error) throw error
      setSuppliers([...suppliers, data])
      setSupplierOpen(false)
      setSupplierForm({ name: '', code: '', phone: '', email: '' })
      toast.success('Tedarikçi eklendi')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ayarlar</h1>
        <p className="text-sm text-muted-foreground mt-1">Sistem ayarları, kullanıcılar ve tedarikçi yönetimi</p>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" />Sistem</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" />Kullanıcılar</TabsTrigger>
          <TabsTrigger value="suppliers"><Building2 className="w-4 h-4 mr-1" />Tedarikçiler</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle>Sistem Ayarları</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {settings.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{s.key}</p>
                      <p className="text-sm text-muted-foreground">{s.description}</p>
                    </div>
                    <pre className="text-xs bg-muted p-2 rounded max-w-xs overflow-auto">{JSON.stringify(s.value, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle>Kullanıcılar</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initProfiles.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell><Badge variant="outline">{ROLE_LABELS[p.role]}</Badge></TableCell>
                      <TableCell>{p.department || '-'}</TableCell>
                      <TableCell>{p.is_active ? <Badge className="bg-emerald-100 text-emerald-700">Aktif</Badge> : <Badge variant="secondary">Pasif</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tedarikçiler</CardTitle>
              <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Yeni Tedarikçi</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Yeni Tedarikçi</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>Firma Adı</Label><Input value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Kod</Label><Input value={supplierForm.code} onChange={e => setSupplierForm({...supplierForm, code: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Telefon</Label><Input value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} /></div>
                    </div>
                    <div className="space-y-2"><Label>E-posta</Label><Input value={supplierForm.email} onChange={e => setSupplierForm({...supplierForm, email: e.target.value})} /></div>
                    <Button onClick={handleAddSupplier} disabled={loading || !supplierForm.name} className="w-full">
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Kaydet
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>Firma Adı</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>E-posta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.code || '-'}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.phone || '-'}</TableCell>
                      <TableCell>{s.email || '-'}</TableCell>
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
