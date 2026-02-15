import { createClient } from '@/lib/supabase/server'
import { BitimisUrunStokClient } from './bitimis-urun-stok-client'

export default async function BitimisUrunStokPage() {
  const supabase = await createClient()

  // Stokta olan şanzımanlar (kalite kontrolden geçenler)
  const { data: stockGearboxes } = await supabase
    .from('gearboxes')
    .select('*, responsible_user:profiles(full_name)')
    .eq('status', 'stokta')
    .order('production_date', { ascending: false })

  // Tüm şanzımanlar - durum dağılımı için
  const { data: allGearboxes } = await supabase
    .from('gearboxes')
    .select('model, status')

  return (
    <BitimisUrunStokClient
      stockGearboxes={stockGearboxes || []}
      allGearboxes={allGearboxes || []}
    />
  )
}
