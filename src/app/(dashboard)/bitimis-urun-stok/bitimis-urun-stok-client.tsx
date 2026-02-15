'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MODEL_LABELS, MODEL_COLORS } from '@/lib/constants'
import type { GearboxModel } from '@/lib/types'
import { PackageCheck, Box, TrendingUp } from 'lucide-react'

interface StockGearbox {
  id: string
  serial_number: string
  model: string
  production_date: string
  production_start?: string
  production_end?: string
  work_order?: string
  responsible_user?: { full_name: string } | { full_name: string }[] | null
}

interface Props {
  stockGearboxes: StockGearbox[]
  allGearboxes: { model: string; status: string }[]
}

export function BitimisUrunStokClient({ stockGearboxes, allGearboxes }: Props) {
  // Model bazında stok sayımı
  const stockByModel = { A: 0, B: 0, C: 0 }
  stockGearboxes.forEach(g => {
    const m = g.model as keyof typeof stockByModel
    if (stockByModel[m] !== undefined) stockByModel[m]++
  })

  const totalStock = stockByModel.A + stockByModel.B + stockByModel.C

  // Toplam üretim sayıları
  const totalByModel = { A: 0, B: 0, C: 0 }
  allGearboxes.forEach(g => {
    const m = g.model as keyof typeof totalByModel
    if (totalByModel[m] !== undefined) totalByModel[m]++
  })

  const getResponsibleName = (ru: StockGearbox['responsible_user']) => {
    if (!ru) return '-'
    if (Array.isArray(ru)) return ru[0]?.full_name || '-'
    return ru.full_name || '-'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bitmiş Ürün Stok</h1>
        <p className="text-sm text-muted-foreground mt-1">Kalite kontrolden geçen ve stokta bekleyen şanzımanlar</p>
      </div>

      {/* Stok Özet Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-slate-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Toplam Stok</p>
                <p className="text-3xl font-bold">{totalStock}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <PackageCheck className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {(['A', 'B', 'C'] as GearboxModel[]).map(model => (
          <Card key={model} className="border-l-4" style={{ borderLeftColor: MODEL_COLORS[model] }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{MODEL_LABELS[model]}</p>
                  <p className="text-3xl font-bold">{stockByModel[model]}</p>
                  <p className="text-xs text-muted-foreground mt-1">Toplam üretim: {totalByModel[model]}</p>
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: MODEL_COLORS[model] + '20' }}>
                  <Box className="w-6 h-6" style={{ color: MODEL_COLORS[model] }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stok Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-5 h-5" />
            Stoktaki Şanzımanlar ({totalStock})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seri No</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Üretim Tarihi</TableHead>
                <TableHead>İş Emri</TableHead>
                <TableHead>Sorumlu</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockGearboxes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <PackageCheck className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                    <p>Stokta şanzıman bulunmuyor</p>
                    <p className="text-xs mt-1">Kalite kontrolden geçen ürünler burada görünecek</p>
                  </TableCell>
                </TableRow>
              ) : stockGearboxes.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono font-bold">{g.serial_number}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{ borderColor: MODEL_COLORS[g.model as GearboxModel], color: MODEL_COLORS[g.model as GearboxModel] }}
                    >
                      {MODEL_LABELS[g.model as GearboxModel]}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(g.production_date).toLocaleDateString('tr-TR')}</TableCell>
                  <TableCell className="font-mono text-sm">{g.work_order || '-'}</TableCell>
                  <TableCell>{getResponsibleName(g.responsible_user)}</TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                      Stokta
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
