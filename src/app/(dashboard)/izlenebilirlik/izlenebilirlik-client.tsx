'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { STATUS_LABELS, STATUS_COLORS, MODEL_LABELS } from '@/lib/constants'
import type { GearboxStatus, GearboxModel } from '@/lib/types'
import { Search, Eye, ArrowRight, Package, Truck, Car, FileText } from 'lucide-react'
import Link from 'next/link'

interface SearchResult {
  type: string
  id?: string
  gearbox_id?: string
  serial_number?: string
  model?: string
  status?: string
  lot_number?: string
  invoice_number?: string
  vin_number?: string
  vehicle_plate?: string
  waybill_number?: string
  material?: { code: string; name: string }
  [key: string]: unknown
}

interface Props {
  query: string
  results: SearchResult[]
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  gearbox: { label: 'Şanzıman', icon: <Package className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700' },
  vehicle: { label: 'Araç Montaj', icon: <Car className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700' },
  shipment: { label: 'Sevkiyat', icon: <Truck className="w-4 h-4" />, color: 'bg-indigo-100 text-indigo-700' },
  lot: { label: 'Lot/İrsaliye', icon: <FileText className="w-4 h-4" />, color: 'bg-amber-100 text-amber-700' },
}

export function IzlenebilirlikClient({ query: initQuery, results }: Props) {
  const [search, setSearch] = useState(initQuery)
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      router.push(`/izlenebilirlik?q=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">İzlenebilirlik</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seri no, VIN/şase no, plaka, irsaliye no veya lot no ile arama yapın
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                className="pl-11 h-12 text-lg"
                placeholder="Seri no, VIN, plaka, irsaliye veya lot no girin..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg">
              <Search className="w-5 h-5 mr-2" />Ara
            </Button>
          </form>
        </CardContent>
      </Card>

      {initQuery && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <strong>&quot;{initQuery}&quot;</strong> için {results.length} sonuç bulundu
          </p>

          {results.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Arama sonucu bulunamadı</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {results.map((r: SearchResult, idx: number) => {
                const type = r.type
                const typeInfo = TYPE_LABELS[type] || TYPE_LABELS.gearbox
                const gearboxId = r.id || r.gearbox_id

                return (
                  <Card key={idx} className="hover:border-primary/50 transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Badge className={typeInfo.color} variant="outline">
                            {typeInfo.icon}
                            <span className="ml-1">{typeInfo.label}</span>
                          </Badge>
                          <div>
                            {r.serial_number && <p className="font-mono font-bold">{r.serial_number}</p>}
                            {r.lot_number && <p className="font-mono text-sm">Lot: {r.lot_number}</p>}
                            {r.vin_number && <p className="text-sm">VIN: <span className="font-mono">{r.vin_number}</span></p>}
                            {r.vehicle_plate && <p className="text-sm">Plaka: <span className="font-mono">{r.vehicle_plate}</span></p>}
                            <div className="flex items-center gap-2 mt-1">
                              {r.model && <Badge variant="outline">{MODEL_LABELS[r.model as GearboxModel] || r.model}</Badge>}
                              {r.status && <Badge className={STATUS_COLORS[r.status as GearboxStatus]} variant="outline">{STATUS_LABELS[r.status as GearboxStatus] || r.status}</Badge>}
                            </div>
                          </div>
                        </div>
                        {gearboxId && type !== 'lot' && (
                          <Link href={`/uretim/${gearboxId}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />Detay <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
