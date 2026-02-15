'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { STATUS_LABELS, STATUS_COLORS, MODEL_LABELS } from '@/lib/constants'
import type { GearboxStatus, GearboxModel, Material, AuditLog } from '@/lib/types'
import {
  Factory, Truck, Warehouse, AlertTriangle, Clock, Cog,
  TrendingUp, PackageCheck, Ban, ArrowDown, ArrowUp, Package,
  ChevronRight, Gauge, ShieldAlert, BarChart3
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useState } from 'react'
import { DateRangeFilter } from '@/components/date-range-filter'

interface CapacityItem {
  materialName: string
  materialCode: string
  currentStock: number
  requiredPerUnit: number
  possibleUnits: number
  unit: string
  isCritical: boolean
}

interface CapacityByModel {
  model: GearboxModel
  maxGearboxes: number
  bottleneck: string | null
  items: CapacityItem[]
}

interface DashboardClientProps {
  prodCounts: Record<string, number>
  stockCounts: Record<string, number>
  shipCounts: Record<string, number>
  statusDist: Record<string, number>
  criticalMaterials: Material[]
  recentAudit: (AuditLog & { user?: { full_name: string } | null })[]
  capacityByModel: CapacityByModel[]
  monthlyTrend: { month: string; A: number; B: number; C: number }[]
  ncrByModel: Record<string, { total: number; open: number }>
  totalShipByModel: Record<string, number>
  totalProdByModel: Record<string, number>
  revizyonByModel: Record<string, number>
  allMaterials: Material[]
  dateRangeStart: string
  dateRangeEnd: string
}

const ENTITY_LABELS: Record<string, string> = {
  gearboxes: 'Şanzıman',
  quality_inspections: 'Kalite Kontrol',
  shipments: 'Sevkiyat',
  vehicle_assemblies: 'Araç Montaj',
  ncr_records: 'NCR',
  gearbox_part_mappings: 'Parça Eşleştirme',
  materials: 'Malzeme',
  material_stock_entries: 'Stok Girişi',
  bom_revisions: 'BOM',
}

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'oluşturuldu',
  UPDATE: 'güncellendi',
  DELETE: 'silindi',
}

const MODEL_BG_COLORS: Record<string, string> = {
  A: 'from-blue-500 to-blue-600',
  B: 'from-emerald-500 to-emerald-600',
  C: 'from-amber-500 to-amber-600',
}

const MODEL_LIGHT_COLORS: Record<string, string> = {
  A: 'bg-blue-50 text-blue-700 border-blue-200',
  B: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  C: 'bg-amber-50 text-amber-700 border-amber-200',
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6', '#ef4444']

export function DashboardClient({
  prodCounts,
  stockCounts,
  shipCounts,
  statusDist,
  criticalMaterials,
  recentAudit,
  capacityByModel,
  monthlyTrend,
  ncrByModel,
  totalShipByModel,
  totalProdByModel,
  revizyonByModel,
  allMaterials,
  dateRangeStart,
  dateRangeEnd,
}: DashboardClientProps) {
  const [selectedCapacityModel, setSelectedCapacityModel] = useState<GearboxModel>('A')

  const totalProd = Object.values(prodCounts).reduce((a, b) => a + b, 0)
  const totalStock = Object.values(stockCounts).reduce((a, b) => a + b, 0)
  const totalShip = Object.values(shipCounts).reduce((a, b) => a + b, 0)
  const totalCapacity = capacityByModel.reduce((a, b) => a + b.maxGearboxes, 0)
  const totalNcr = Object.values(ncrByModel).reduce((a, b) => a + b.total, 0)
  const totalRevisyon = Object.values(revizyonByModel).reduce((a, b) => a + b, 0)

  const statusChartData = Object.entries(statusDist).map(([status, count]) => ({
    name: STATUS_LABELS[status as GearboxStatus] || status,
    value: count,
    status,
  }))

  const selectedCapacity = capacityByModel.find(c => c.model === selectedCapacityModel)

  const modelComparisonData = (['A', 'B', 'C'] as const).map(m => ({
    name: `Model ${m}`,
    'Toplam Üretim': totalProdByModel[m] || 0,
    'Toplam Sevkiyat': totalShipByModel[m] || 0,
    'Stokta': stockCounts[m] || 0,
    'NCR': ncrByModel[m]?.total || 0,
    'Revizyon/İade': revizyonByModel[m] || 0,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Anasayfa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Üretim kapasitesi, stok durumu ve performans özeti
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter start={dateRangeStart} end={dateRangeEnd} label="Tarih" />
          <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 1: PRODUCTION CAPACITY (STAR FEATURE)
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {capacityByModel.map((cap) => (
          <Card
            key={cap.model}
            className={`relative overflow-hidden cursor-pointer transition-all border-2 ${
              selectedCapacityModel === cap.model
                ? 'border-blue-500 shadow-lg shadow-blue-100'
                : 'border-transparent hover:border-slate-200'
            }`}
            onClick={() => setSelectedCapacityModel(cap.model)}
          >
            <div className={`absolute inset-0 bg-linear-to-br ${MODEL_BG_COLORS[cap.model]} opacity-5`} />
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg bg-linear-to-br ${MODEL_BG_COLORS[cap.model]} flex items-center justify-center`}>
                    <Cog className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-sm text-slate-600">Model {cap.model}</span>
                </div>
                <Badge variant="outline" className={MODEL_LIGHT_COLORS[cap.model]}>
                  {cap.maxGearboxes > 0 ? 'Üretilebilir' : 'Yetersiz'}
                </Badge>
              </div>
              <div className="text-center py-3">
                <div className="text-4xl font-black text-slate-900 dark:text-white">
                  {cap.maxGearboxes}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  adet şanzıman üretilebilir
                </p>
              </div>
              {cap.bottleneck && cap.maxGearboxes > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-md mt-2">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span className="truncate">Darboğaz: <strong>{cap.bottleneck}</strong></span>
                </div>
              )}
              {cap.bottleneck && cap.maxGearboxes === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-md mt-2">
                  <Ban className="w-3 h-3 shrink-0" />
                  <span className="truncate">{cap.bottleneck === 'BOM tanımlı değil' ? 'BOM tanımlı değil' : `Eksik: ${cap.bottleneck}`}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total capacity summary */}
      <Card className="bg-linear-to-r from-slate-900 to-slate-800 text-white border-0">
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Gauge className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-300">Toplam Üretim Kapasitesi (Mevcut Stok ile)</p>
                <p className="text-3xl font-black">{totalCapacity} <span className="text-sm font-normal text-slate-400">adet şanzıman</span></p>
              </div>
            </div>
            <div className="flex gap-6">
              {capacityByModel.map((cap) => (
                <div key={cap.model} className="text-center">
                  <div className="text-xs text-slate-400">Model {cap.model}</div>
                  <div className="text-xl font-bold">{cap.maxGearboxes}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════
          SECTION 2: CAPACITY DETAIL TABLE
          ═══════════════════════════════════════════ */}
      {selectedCapacity && selectedCapacity.items.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  Model {selectedCapacityModel} - Malzeme Bazlı Kapasite Detayı
                </CardTitle>
                <CardDescription className="mt-1">
                  Her malzeme ile kaç adet şanzıman üretilebileceği ve eksik miktarlar
                </CardDescription>
              </div>
              <div className="flex gap-1">
                {(['A', 'B', 'C'] as GearboxModel[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedCapacityModel(m)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      selectedCapacityModel === m
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Model {m}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Malzeme</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Kod</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Mevcut Stok</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Birim Gereksinim</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Üretilebilir</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">+10 İçin Gereken</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-500">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCapacity.items.map((item, idx) => {
                    const neededFor10More = Math.max(0, (selectedCapacity.maxGearboxes + 10) * item.requiredPerUnit - item.currentStock)
                    const isBottleneck = idx === 0 && selectedCapacity.items.length > 1
                    const capacityPct = selectedCapacity.maxGearboxes > 0
                      ? Math.min(100, (item.possibleUnits / (selectedCapacity.maxGearboxes * 2)) * 100)
                      : 0

                    return (
                      <tr
                        key={item.materialCode}
                        className={`border-b border-slate-50 transition-colors hover:bg-slate-50 ${
                          isBottleneck ? 'bg-amber-50/50' : ''
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {item.isCritical && (
                              <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            )}
                            <span className="font-medium text-slate-700">{item.materialName}</span>
                            {isBottleneck && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                                Darboğaz
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-xs">{item.materialCode}</td>
                        <td className="py-3 px-3 text-right font-semibold">{item.currentStock} <span className="text-xs text-slate-400">{item.unit}</span></td>
                        <td className="py-3 px-3 text-right">{item.requiredPerUnit} <span className="text-xs text-slate-400">{item.unit}</span></td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-bold ${item.possibleUnits <= 5 ? 'text-red-600' : item.possibleUnits <= 20 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {item.possibleUnits === Infinity ? '∞' : item.possibleUnits}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">adet</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {neededFor10More > 0 ? (
                            <span className="text-blue-600 font-medium">+{Math.ceil(neededFor10More)} <span className="text-xs text-slate-400">{item.unit}</span></span>
                          ) : (
                            <span className="text-emerald-500 text-xs">Yeterli</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex justify-center">
                            <div className="w-20">
                              <Progress
                                value={capacityPct}
                                className="h-1.5"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════
          SECTION 3: KPI CARDS - Profesyonel Tasarım
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Aylık Üretim */}
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b from-blue-500 to-blue-600" />
          <CardContent className="pt-5 pb-4 pl-5 relative">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Factory className="w-5 h-5" strokeWidth={2} />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Bu ay</span>
            </div>
            <p className="text-3xl font-extrabold mt-3 text-slate-900 dark:text-white tabular-nums">{totalProd}</p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Aylık Üretim</p>
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">A:{prodCounts.A || 0}</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">B:{prodCounts.B || 0}</span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">C:{prodCounts.C || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Aylık Sevkiyat */}
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b from-indigo-500 to-indigo-600" />
          <CardContent className="pt-5 pb-4 pl-5 relative">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Truck className="w-5 h-5" strokeWidth={2} />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Bu ay</span>
            </div>
            <p className="text-3xl font-extrabold mt-3 text-slate-900 dark:text-white tabular-nums">{totalShip}</p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Aylık Sevkiyat</p>
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">A:{shipCounts.A || 0}</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">B:{shipCounts.B || 0}</span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">C:{shipCounts.C || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Stokta */}
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b from-emerald-500 to-emerald-600" />
          <CardContent className="pt-5 pb-4 pl-5 relative">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Warehouse className="w-5 h-5" strokeWidth={2} />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Güncel</span>
            </div>
            <p className="text-3xl font-extrabold mt-3 text-slate-900 dark:text-white tabular-nums">{totalStock}</p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Stokta</p>
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">A:{stockCounts.A || 0}</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">B:{stockCounts.B || 0}</span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">C:{stockCounts.C || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Kapasite */}
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b from-violet-500 to-violet-600" />
          <CardContent className="pt-5 pb-4 pl-5 relative">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Gauge className="w-5 h-5" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-extrabold mt-3 text-slate-900 dark:text-white tabular-nums">{totalCapacity}</p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Kapasite</p>
            <p className="text-xs text-muted-foreground mt-2">Mevcut stokla üretilebilir adet</p>
          </CardContent>
        </Card>

        {/* NCR / Red */}
        <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-linear-to-b from-red-500 to-red-600" />
          <CardContent className="pt-5 pb-4 pl-5 relative">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                <Ban className="w-5 h-5" strokeWidth={2} />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Toplam</span>
            </div>
            <p className="text-3xl font-extrabold mt-3 text-slate-900 dark:text-white tabular-nums">{totalNcr}</p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">NCR / Red</p>
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">A:{ncrByModel.A?.total || 0}</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">B:{ncrByModel.B?.total || 0}</span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">C:{ncrByModel.C?.total || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Kritik Stok */}
        <Card className={`overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300 ${
          criticalMaterials.length > 0
            ? 'bg-red-50/50 dark:bg-red-950/20 ring-1 ring-red-200 dark:ring-red-900/50'
            : 'bg-white dark:bg-slate-900'
        }`}>
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${
            criticalMaterials.length > 0 ? 'bg-linear-to-b from-red-500 to-red-600' : 'bg-linear-to-b from-emerald-500 to-emerald-600'
          }`} />
          <CardContent className="pt-5 pb-4 pl-5 relative">
            <div className="flex items-start justify-between">
              <div className={`p-2.5 rounded-xl ${
                criticalMaterials.length > 0 ? 'bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${criticalMaterials.length > 0 ? 'animate-pulse' : ''}`} strokeWidth={2} />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Uyarı</span>
            </div>
            <p className={`text-3xl font-extrabold mt-3 tabular-nums ${
              criticalMaterials.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
            }`}>{criticalMaterials.length}</p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Kritik Stok</p>
            <p className="text-xs text-muted-foreground mt-2">
              {criticalMaterials.length > 0 ? 'Malzeme kritik seviyede' : 'Tüm stoklar yeterli'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 4: CHARTS
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Aylık Üretim Trendi (Son 6 Ay)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="A" name="Model A" stroke="#3b82f6" fill="url(#colorA)" strokeWidth={2} />
                <Area type="monotone" dataKey="B" name="Model B" stroke="#10b981" fill="url(#colorB)" strokeWidth={2} />
                <Area type="monotone" dataKey="C" name="Model C" stroke="#f59e0b" fill="url(#colorC)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status distribution */}
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

      {/* ═══════════════════════════════════════════
          SECTION 5: MODEL COMPARISON & NCR
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model comparison bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              Model Bazlı Karşılaştırma (Toplam)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modelComparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="name" fontSize={12} width={70} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Toplam Üretim" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Toplam Sevkiyat" fill="#6366f1" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Stokta" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="NCR" fill="#ef4444" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Revizyon/İade" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Per-model summary cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Model Detay Özeti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(['A', 'B', 'C'] as GearboxModel[]).map((model) => {
                const cap = capacityByModel.find(c => c.model === model)
                return (
                  <div key={model} className={`p-4 rounded-xl border ${MODEL_LIGHT_COLORS[model]}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-base">Model {model}</h4>
                      <Badge variant="outline" className="font-mono">
                        Kapasite: {cap?.maxGearboxes || 0}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-5 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold">{totalProdByModel[model] || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Toplam Üretim</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{totalShipByModel[model] || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Sevkiyat</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">{stockCounts[model] || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Stokta</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{ncrByModel[model]?.total || 0}</p>
                        <p className="text-[10px] text-muted-foreground">NCR</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-amber-600">{revizyonByModel[model] || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Rev/İade</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 6: CRITICAL MATERIALS & ACTIVITY
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity feed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              Son Aktiviteler
            </CardTitle>
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
                        {log.user?.full_name || log.user_name || 'Sistem'} &bull;{' '}
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

        {/* Critical stock alerts */}
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
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {criticalMaterials.map((mat) => {
                  const stockPct = mat.min_stock > 0 ? Math.round((mat.current_stock / mat.min_stock) * 100) : 0
                  return (
                    <div key={mat.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{mat.name}</p>
                          {mat.is_critical && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-100 text-red-700 border-red-200">
                              Kritik
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{mat.code} &bull; Min: {mat.min_stock} {mat.unit}</p>
                        <div className="mt-1.5">
                          <Progress value={stockPct} className="h-1.5" />
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-red-600">{mat.current_stock} <span className="text-xs font-normal">{mat.unit}</span></p>
                        <p className="text-xs text-red-500">%{stockPct} doluluk</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-emerald-600 text-sm">
                <PackageCheck className="w-6 h-6 mr-2" />
                Tüm malzeme stokları yeterli seviyede
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
