'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ROLE_LABELS } from '@/lib/constants'
import type { SystemSetting, Profile, Supplier, UserRole } from '@/lib/types'
import { Settings, Users, Building2, Plus, Loader2, Pencil, Key, UserCheck, UserX, Trash2, Shield } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  settings: SystemSetting[]
  profiles: Profile[]
  suppliers: Supplier[]
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Yönetici' },
  { value: 'quality', label: 'Kalite' },
  { value: 'production', label: 'Üretim' },
  { value: 'logistics', label: 'Lojistik' },
  { value: 'viewer', label: 'İzleyici' },
]

export function AyarlarClient({ settings, profiles: initProfiles, suppliers: initSuppliers }: Props) {
  // Suppliers
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [supplierForm, setSupplierForm] = useState({ name: '', code: '', phone: '', email: '' })
  const [suppliers, setSuppliers] = useState(initSuppliers)

  // Users
  const [profiles, setProfiles] = useState(initProfiles)
  const [userOpen, setUserOpen] = useState(false)
  const [editUserOpen, setEditUserOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const [userForm, setUserForm] = useState({
    email: '', password: '', full_name: '', role: 'viewer' as UserRole, department: '',
  })
  const [editForm, setEditForm] = useState({
    full_name: '', role: 'viewer' as UserRole, department: '', is_active: true,
  })

  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  // === KULLANICI YÖNETİMİ ===
  const handleCreateUser = async () => {
    if (!userForm.email || !userForm.password || !userForm.full_name) {
      toast.error('E-posta, şifre ve ad soyad zorunlu')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('admin_create_user', {
        p_email: userForm.email,
        p_password: userForm.password,
        p_full_name: userForm.full_name,
        p_role: userForm.role,
        p_department: userForm.department || null,
      })
      if (error) throw error

      toast.success(`${userForm.full_name} kullanıcısı oluşturuldu`)
      setUserOpen(false)
      setUserForm({ email: '', password: '', full_name: '', role: 'viewer', department: '' })
      router.refresh()
      // Refresh profiles
      const { data: refreshed } = await supabase.from('profiles').select('*').order('full_name')
      if (refreshed) setProfiles(refreshed)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata oluştu')
    } finally { setLoading(false) }
  }

  const openEditUser = (user: Profile) => {
    setSelectedUser(user)
    setEditForm({
      full_name: user.full_name,
      role: user.role,
      department: user.department || '',
      is_active: user.is_active,
    })
    setEditUserOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!selectedUser) return
    setLoading(true)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: editForm.full_name,
        role: editForm.role,
        department: editForm.department || null,
        is_active: editForm.is_active,
      }).eq('id', selectedUser.id)
      if (error) throw error

      setProfiles(profiles.map(p => p.id === selectedUser.id ? { ...p, ...editForm } : p))
      setEditUserOpen(false)
      setSelectedUser(null)
      toast.success('Kullanıcı güncellendi')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const openPasswordChange = (user: Profile) => {
    setSelectedUser(user)
    setNewPassword('')
    setPasswordOpen(true)
  }

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) return
    if (newPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalı')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.rpc('admin_update_password', {
        p_user_id: selectedUser.id,
        p_new_password: newPassword,
      })
      if (error) throw error

      setPasswordOpen(false)
      setNewPassword('')
      setSelectedUser(null)
      toast.success('Şifre güncellendi')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Hata')
    } finally { setLoading(false) }
  }

  const handleToggleActive = async (user: Profile) => {
    const newStatus = !user.is_active
    const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', user.id)
    if (error) {
      toast.error('Hata: ' + error.message)
      return
    }
    setProfiles(profiles.map(p => p.id === user.id ? { ...p, is_active: newStatus } : p))
    toast.success(newStatus ? 'Kullanıcı aktif edildi' : 'Kullanıcı pasif edildi')
  }

  const handleDeleteUser = async (user: Profile) => {
    if (!confirm(`"${user.full_name}" kullanıcısını kalıcı olarak silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`)) return
    setLoading(true)
    try {
      // Önce profili sil
      const { error: profileErr } = await supabase.from('profiles').delete().eq('id', user.id)
      if (profileErr) throw profileErr

      // Auth kullanıcısını da sil (admin RPC ile)
      try {
        await supabase.rpc('admin_delete_user', { p_user_id: user.id })
      } catch {
        // Auth silme başarısız olsa bile profil silindi
        console.warn('Auth user silme başarısız oldu, profil silindi')
      }

      setProfiles(profiles.filter(p => p.id !== user.id))
      toast.success(`${user.full_name} kalıcı olarak silindi`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Silme hatası - ilişkili kayıtlar olabilir')
    } finally { setLoading(false) }
  }

  // === TEDARİKÇİ ===
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
        <p className="text-sm text-muted-foreground mt-1">Kullanıcı yönetimi, sistem ayarları ve tedarikçiler</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" />Kullanıcılar</TabsTrigger>
          <TabsTrigger value="suppliers"><Building2 className="w-4 h-4 mr-1" />Tedarikçiler</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1" />Sistem</TabsTrigger>
        </TabsList>

        {/* KULLANICILAR */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Shield className="w-5 h-5" />Kullanıcı Yönetimi</CardTitle>
              <Dialog open={userOpen} onOpenChange={setUserOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" />Yeni Kullanıcı</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Ad Soyad *</Label>
                      <Input value={userForm.full_name} onChange={e => setUserForm({ ...userForm, full_name: e.target.value })} placeholder="Ahmet Yıldız" />
                    </div>
                    <div className="space-y-2">
                      <Label>E-posta *</Label>
                      <Input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} placeholder="ahmet@powermac.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Şifre *</Label>
                      <Input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder="En az 6 karakter" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Rol</Label>
                        <Select value={userForm.role} onValueChange={v => setUserForm({ ...userForm, role: v as UserRole })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Departman</Label>
                        <Input value={userForm.department} onChange={e => setUserForm({ ...userForm, department: e.target.value })} placeholder="Üretim" />
                      </div>
                    </div>
                    <Button onClick={handleCreateUser} disabled={loading || !userForm.email || !userForm.password || !userForm.full_name} className="w-full">
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                      Kullanıcı Oluştur
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map(p => (
                    <TableRow key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={p.role === 'admin' ? 'border-red-300 text-red-700' : ''}>
                          {ROLE_LABELS[p.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>{p.department || '-'}</TableCell>
                      <TableCell>
                        {p.is_active
                          ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">Aktif</Badge>
                          : <Badge variant="secondary">Pasif</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" title="Düzenle" onClick={() => openEditUser(p)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Şifre Değiştir" onClick={() => openPasswordChange(p)}>
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title={p.is_active ? 'Pasif Et' : 'Aktif Et'} onClick={() => handleToggleActive(p)}>
                            {p.is_active ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-emerald-500" />}
                          </Button>
                          <Button variant="ghost" size="sm" title="Kalıcı Sil" onClick={() => handleDeleteUser(p)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEDARİKÇİLER */}
        <TabsContent value="suppliers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Tedarikçiler</CardTitle>
              <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Yeni Tedarikçi</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Yeni Tedarikçi</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>Firma Adı</Label><Input value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Kod</Label><Input value={supplierForm.code} onChange={e => setSupplierForm({ ...supplierForm, code: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Telefon</Label><Input value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></div>
                    </div>
                    <div className="space-y-2"><Label>E-posta</Label><Input value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} /></div>
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

        {/* SİSTEM AYARLARI */}
        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle>Sistem Ayarları</CardTitle></CardHeader>
            <CardContent>
              {settings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Henüz sistem ayarı yok</p>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Kullanıcı Düzenleme Modalı */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kullanıcı Düzenle: {selectedUser?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Ad Soyad</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v as UserRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Departman</Label>
                <Input value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleUpdateUser} disabled={loading || !editForm.full_name} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
              Güncelle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Şifre Değiştirme Modalı */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Şifre Değiştir: {selectedUser?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Yeni Şifre</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="En az 6 karakter" />
            </div>
            <Button onClick={handleChangePassword} disabled={loading || newPassword.length < 6} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
              Şifreyi Güncelle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
