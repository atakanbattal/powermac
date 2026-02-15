'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_LABELS, MODEL_LABELS } from '@/lib/constants'
import { ShieldCheck, Plus, Eye, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react'

interface Props {
  inspections: {
    id: string; overall_result: string; inspection_date: string; is_draft: boolean; comments?: string;
    gearbox?: { serial_number: string; model: string; status: string; parts_mapping_complete: boolean } | null;
    inspector?: { full_name: string } | null;
    control_plan?: { model: string; revision_no: number } | null;
  }[]
  pendingGearboxes: { id: string; serial_number: string; model: string; parts_mapping_complete: boolean }[]
}

const RESULT_ICON = {
  ok: <CheckCircle className="w-4 h-4 text-emerald-600" />,
  ret: <XCircle className="w-4 h-4 text-red-600" />,
  beklemede: <Clock className="w-4 h-4 text-amber-500" />,
}

const RESULT_BADGE = {
  ok: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ret: 'bg-red-100 text-red-700 border-red-200',
  beklemede: 'bg-amber-100 text-amber-700 border-amber-200',
}

export function KaliteKontrolClient({ inspections, pendingGearboxes }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kalite Kontrol</h1>
          <p className="text-sm text-muted-foreground mt-1">Final kalite kontrol kayıtları ve ölçüm sonuçları</p>
        </div>
      </div>

      {/* Bekleyen şanzımanlar */}
      {pendingGearboxes.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Final Kontrol Bekleyen Şanzımanlar ({pendingGearboxes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingGearboxes.map(g => (
                <div key={g.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                  <div>
                    <p className="font-mono font-medium">{g.serial_number}</p>
                    <p className="text-xs text-muted-foreground">{MODEL_LABELS[g.model as keyof typeof MODEL_LABELS]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!g.parts_mapping_complete && (
                      <Badge variant="destructive" className="text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Parça eksik</Badge>
                    )}
                    <Link href={`/kalite-kontrol/yeni?gearbox=${g.id}`}>
                      <Button size="sm" disabled={!g.parts_mapping_complete}>
                        <ShieldCheck className="w-3 h-3 mr-1" />Kontrol
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kontrol kayıtları */}
      <Card>
        <CardHeader>
          <CardTitle>Kontrol Kayıtları</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seri No</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Kontrol Planı</TableHead>
                <TableHead>Kontrol Eden</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Sonuç</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspections.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Kayıt yok</TableCell></TableRow>
              ) : inspections.map(insp => (
                <TableRow key={insp.id}>
                  <TableCell className="font-mono font-medium">{insp.gearbox?.serial_number}</TableCell>
                  <TableCell><Badge variant="outline">{MODEL_LABELS[insp.gearbox?.model as keyof typeof MODEL_LABELS] || '-'}</Badge></TableCell>
                  <TableCell>Rev {insp.control_plan?.revision_no}</TableCell>
                  <TableCell>{insp.inspector?.full_name || '-'}</TableCell>
                  <TableCell>{new Date(insp.inspection_date).toLocaleDateString('tr-TR')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {RESULT_ICON[insp.overall_result as keyof typeof RESULT_ICON]}
                      <Badge className={RESULT_BADGE[insp.overall_result as keyof typeof RESULT_BADGE]} variant="outline">
                        {insp.overall_result === 'ok' ? 'GEÇTİ' : insp.overall_result === 'ret' ? 'RED' : 'BEKLİYOR'}
                      </Badge>
                      {insp.is_draft && <Badge variant="secondary" className="text-xs">Taslak</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/kalite-kontrol/${insp.id}`}>
                      <Button variant="ghost" size="sm"><Eye className="w-4 h-4 mr-1" />Detay</Button>
                    </Link>
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
