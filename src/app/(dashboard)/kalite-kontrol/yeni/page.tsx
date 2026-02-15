import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { YeniKontrolClient } from './yeni-kontrol-client'

export default async function YeniKontrolPage({ searchParams }: { searchParams: Promise<{ gearbox?: string }> }) {
  const { gearbox: gearboxId } = await searchParams
  if (!gearboxId) redirect('/kalite-kontrol')

  const supabase = await createClient()

  const { data: gearbox } = await supabase
    .from('gearboxes')
    .select('*')
    .eq('id', gearboxId)
    .single()

  if (!gearbox) redirect('/kalite-kontrol')

  // Parça eşleştirme kontrolü
  if (!gearbox.parts_mapping_complete) {
    redirect(`/uretim/${gearboxId}?warning=parts_incomplete`)
  }

  // Aktif kontrol planını bul
  const { data: controlPlan } = await supabase
    .from('control_plan_revisions')
    .select('*, control_plan_items(*)')
    .eq('model', gearbox.model)
    .eq('is_active', true)
    .order('revision_no', { ascending: false })
    .limit(1)
    .single()

  return (
    <YeniKontrolClient
      gearbox={gearbox}
      controlPlan={controlPlan}
    />
  )
}
