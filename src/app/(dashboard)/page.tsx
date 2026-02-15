import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './dashboard-client'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Aylık üretim (mevcut ay)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: monthlyProd } = await supabase
    .from('gearboxes')
    .select('model')
    .gte('production_date', startOfMonth.toISOString().split('T')[0])

  // Stokta olanlar
  const { data: stockItems } = await supabase
    .from('gearboxes')
    .select('model')
    .eq('status', 'stokta')

  // Aylık sevkiyat
  const { data: monthlyShip } = await supabase
    .from('shipments')
    .select('gearbox_id, gearboxes(model)')
    .gte('shipment_date', startOfMonth.toISOString().split('T')[0])

  // Durum dağılımı
  const { data: allGearboxes } = await supabase
    .from('gearboxes')
    .select('status')

  // Kritik malzemeler
  const { data: criticalMaterials } = await supabase
    .from('materials')
    .select('*')
    .lt('current_stock', 0.01) // Will use raw query to compare with min_stock
    .order('current_stock', { ascending: true })
    .limit(5)

  // Kritik stok: current_stock <= min_stock olan malzemeler
  const { data: lowStockMaterials } = await supabase
    .from('materials')
    .select('*')
    .order('current_stock', { ascending: true })
    .limit(10)

  const criticalMats = (lowStockMaterials || []).filter(m => m.current_stock <= m.min_stock && m.min_stock > 0)

  // Son aktiviteler
  const { data: recentAudit } = await supabase
    .from('audit_logs')
    .select('*, user:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(8)

  // İstatistikleri hesapla
  const prodCounts = { A: 0, B: 0, C: 0 }
  ;(monthlyProd || []).forEach(g => { prodCounts[g.model as keyof typeof prodCounts]++ })

  const stockCounts = { A: 0, B: 0, C: 0 }
  ;(stockItems || []).forEach(g => { stockCounts[g.model as keyof typeof stockCounts]++ })

  const shipCounts = { A: 0, B: 0, C: 0 }
  ;(monthlyShip || []).forEach((s: Record<string, unknown>) => {
    const gb = s.gearboxes as { model: string } | null
    if (gb) shipCounts[gb.model as keyof typeof shipCounts]++
  })

  const statusDist: Record<string, number> = {}
  ;(allGearboxes || []).forEach(g => {
    statusDist[g.status] = (statusDist[g.status] || 0) + 1
  })

  return (
    <DashboardClient
      prodCounts={prodCounts}
      stockCounts={stockCounts}
      shipCounts={shipCounts}
      statusDist={statusDist}
      criticalMaterials={criticalMats}
      recentAudit={recentAudit || []}
    />
  )
}
