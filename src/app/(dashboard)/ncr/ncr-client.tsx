'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NCR_STATUS_LABELS } from '@/lib/constants'
import type { NcrRecord, NcrStatus } from '@/lib/types'
import { AlertTriangle } from 'lucide-react'

const NCR_COLORS: Record<NcrStatus, string> = {
  acik: 'bg-red-100 text-red-700',
  analiz: 'bg-amber-100 text-amber-700',
  aksiyon: 'bg-blue-100 text-blue-700',
  kapandi: 'bg-emerald-100 text-emerald-700',
}

interface Props {
  ncrs: (NcrRecord & { gearbox?: { serial_number: string; model: string } | null; responsible_user?: { full_name: string } | null })[]
}

export function NcrClient({ ncrs }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Uygunsuzluk Kayıtları (NCR)</h1>
        <p className="text-sm text-muted-foreground mt-1">RET sonuçlarından otomatik oluşturulan veya manuel NCR kayıtları</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {(['acik', 'analiz', 'aksiyon', 'kapandi'] as NcrStatus[]).map(s => (
          <Card key={s}>
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{NCR_STATUS_LABELS[s]}</p>
              <p className="text-2xl font-bold">{ncrs.filter(n => n.status === s).length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NCR No</TableHead>
                <TableHead>Şanzıman</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Sorumlu</TableHead>
                <TableHead>Hedef Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ncrs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Kayıt yok</TableCell></TableRow>
              ) : ncrs.map(n => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono font-bold">{n.ncr_number}</TableCell>
                  <TableCell className="font-mono">{n.gearbox?.serial_number || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">{n.description}</TableCell>
                  <TableCell><Badge className={NCR_COLORS[n.status]} variant="outline">{NCR_STATUS_LABELS[n.status]}</Badge></TableCell>
                  <TableCell>{n.responsible_user?.full_name || '-'}</TableCell>
                  <TableCell>{n.target_date ? new Date(n.target_date).toLocaleDateString('tr-TR') : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
