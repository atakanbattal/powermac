'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_COLORS, MODEL_COLORS } from '@/lib/constants'
import type { GearboxStatus, Material, AuditLog } from '@/lib/types'
import { Factory, Truck, Warehouse, AlertTriangle, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface DashboardClientProps {
  prodCounts: Record<string, number>
  stockCounts: Record<string, number>
  shipCounts: Record<string, number>
  statusDist: Record<string, number>
  criticalMaterials: Material[]
  recentAudit: (AuditLog & { user?: { full_name: string } | null })[]
}

const ENTITY_LABELS: Record<string, string> = {
  gearboxes: 'Şanzıman',
  quality_inspections: 'Kalite Kontrol',
  shipments: 'Sevkiyat',
  vehicle_assemblies: 'Araç Montaj',
  ncr_records: 'NCR',
  gearbox_part_mappings: 'Parça Eşleştirme',
}

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'oluşturuldu',
  UPDATE: 'güncellendi',
  DELETE: 'silindi',
}

export function DashboardClient({
  prodCounts,
  stockCounts,
  shipCounts,
  statusDist,
  criticalMaterials,
  recentAudit,
}: DashboardClientProps) {
  const totalProd = Object.values(prodCounts).reduce((a, b) => a + b, 0)
  const totalStock = Object.values(stockCounts).reduce((a, b) => a + b, 0)
  const totalShip = Object.values(shipCounts).reduce((a, b) => a + b, 0)

  const statusChartData = Object.entries(statusDist).map(([status, count]) => ({
    name: STATUS_LABELS[status as GearboxStatus] || status,
    value: count,
    status,
  }))

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6', '#ef4444']

  const modelBarData = [
    { name: 'Model A', uretim: prodCounts.A, sevkiyat: shipCounts.A, stok: stockCounts.A },
    { name: 'Model B', uretim: prodCounts.B, sevkiyat: shipCounts.B, stok: stockCounts.B },
    { name: 'Model C', uretim: prodCounts.C, sevkiyat: shipCounts.C, stok: stockCounts.C },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Üretim, sevkiyat ve stok durumu özeti</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aylık Üretim</p>
                <h3 className="text-2xl font-bold mt-1">{totalProd} <span className="text-sm font-normal text-muted-foreground">adet</span></h3>
              </div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Factory className="w-5 h-5" />
              </div>
            </div>
            <div className="flex gap-2 text-xs font-medium">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">A: {prodCounts.A}</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">B: {prodCounts.B}</span>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded">C: {prodCounts.C}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aylık Sevkiyat</p>
                <h3 className="text-2xl font-bold mt-1">{totalShip} <span className="text-sm font-normal text-muted-foreground">adet</span></h3>
              </div>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <div className="flex gap-2 text-xs font-medium">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">A: {shipCounts.A}</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">B: {shipCounts.B}</span>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded">C: {shipCounts.C}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Güncel Stok</p>
                <h3 className="text-2xl font-bold mt-1">{totalStock} <span className="text-sm font-normal text-muted-foreground">adet</span></h3>
              </div>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Warehouse className="w-5 h-5" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {(['A', 'B', 'C'] as const).map(m => (
                <div key={m} className="p-1.5 bg-muted rounded">
                  <div className="text-xs text-muted-foreground">{m}</div>
                  <div className="font-bold text-sm">{stockCounts[m]}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={criticalMaterials.length > 0 ? 'border-red-200 bg-red-50/30' : ''}>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm font-bold text-red-600">KRİTİK STOK</p>
                <h3 className="text-lg font-bold mt-1">
                  {criticalMaterials.length > 0 ? criticalMaterials[0].name : 'Sorun Yok'}
                </h3>
              </div>
              <div className={`p-2 rounded-lg ${criticalMaterials.length > 0 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            {criticalMaterials.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {criticalMaterials.length} malzeme kritik stok seviyesinde
              </p>
            ) : (
              <p className="text-sm text-emerald-600">Tüm malzemeler yeterli seviyede</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Model Bazlı Dağılım</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modelBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="uretim" name="Üretim" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sevkiyat" name="Sevkiyat" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="stok" name="Stok" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Durum Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            {statusChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusChartData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-4">
                  {statusChartData.map((item, i) => (
                    <div key={item.status} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Henüz veri yok
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Activity & Critical Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Son Aktiviteler</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAudit.length > 0 ? (
              <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-2.5 before:w-0.5 before:bg-muted">
                {recentAudit.map((log) => (
                  <div key={log.id} className="relative pl-8">
                    <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full border-2 border-white bg-primary" />
                    <div>
                      <p className="text-sm font-medium">
                        {ENTITY_LABELS[log.entity_type] || log.entity_type} {ACTION_LABELS[log.action] || log.action}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {log.user?.full_name || 'Sistem'} &bull;{' '}
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: tr })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                <Clock className="w-8 h-8 mb-2 opacity-50" />
                Henüz aktivite yok
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Kritik Stok Uyarıları
            </CardTitle>
            {criticalMaterials.length > 0 && (
              <Badge variant="destructive">{criticalMaterials.length} Aktif</Badge>
            )}
          </CardHeader>
          <CardContent>
            {criticalMaterials.length > 0 ? (
              <div className="space-y-3">
                {criticalMaterials.map((mat) => (
                  <div key={mat.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{mat.name}</p>
                      <p className="text-xs text-muted-foreground">{mat.code} &bull; Min: {mat.min_stock} {mat.unit}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{mat.current_stock} {mat.unit}</p>
                      <p className="text-xs text-red-500">Kritik seviyede</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-emerald-600 text-sm">
                Tüm malzeme stokları yeterli seviyede
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
