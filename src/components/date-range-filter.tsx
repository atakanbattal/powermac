'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from 'lucide-react'

interface DateRangeFilterProps {
  start: string // YYYY-MM-DD
  end: string
  paramStart?: string
  paramEnd?: string
  label?: string
}

export function DateRangeFilter({
  start,
  end,
  paramStart = 'start',
  paramEnd = 'end',
  label = 'Tarih Aralığı',
}: DateRangeFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [localStart, setLocalStart] = useState(start)
  const [localEnd, setLocalEnd] = useState(end)

  const applyWithDates = (s: string, e: string) => {
    const params = new URLSearchParams()
    params.set(paramStart, s)
    params.set(paramEnd, e)
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  const apply = () => {
    applyWithDates(localStart, localEnd)
  }

  const setQuick = (days: number) => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const s = startDate.toISOString().split('T')[0]
    const e = endDate.toISOString().split('T')[0]
    setLocalStart(s)
    setLocalEnd(e)
    applyWithDates(s, e)
  }

  const setThisMonth = () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const s = startOfMonth.toISOString().split('T')[0]
    const e = endOfMonth.toISOString().split('T')[0]
    setLocalStart(s)
    setLocalEnd(e)
    applyWithDates(s, e)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="w-4 h-4" />
          {label}
          <span className="text-muted-foreground font-normal">
            ({new Date(start).toLocaleDateString('tr-TR')} - {new Date(end).toLocaleDateString('tr-TR')})
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { setQuick(7); apply() }}>
              Son 7 gün
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setQuick(30); apply() }}>
              Son 30 gün
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setThisMonth(); apply() }}>
              Bu ay
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Başlangıç</Label>
              <Input
                type="date"
                value={localStart}
                onChange={e => setLocalStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bitiş</Label>
              <Input
                type="date"
                value={localEnd}
                onChange={e => setLocalEnd(e.target.value)}
              />
            </div>
          </div>
          <Button className="w-full" onClick={apply}>
            Uygula
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
