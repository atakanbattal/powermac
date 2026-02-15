import { createClient } from '@/lib/supabase/server'
import { TesellumClient } from './tesellum-client'

export default async function TesellumPage() {
  const supabase = await createClient()

  const [
    { data: materials },
    { data: suppliers },
    { data: receipts },
  ] = await Promise.all([
    supabase.from('materials').select('id, code, name, unit').eq('is_active', true).order('name'),
    supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
    supabase.from('material_receipts').select('*, material:materials(code, name, unit), supplier:suppliers(name)').order('created_at', { ascending: false }).limit(200),
  ])

  return (
    <TesellumClient
      materials={materials || []}
      suppliers={suppliers || []}
      receipts={receipts || []}
    />
  )
}
