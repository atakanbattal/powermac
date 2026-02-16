import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Demo verilerini temizler (tesellüm + üretim).
 * Sadece admin rolündeki kullanıcılar erişebilir.
 * GET /api/admin/cleanup-demo
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz - sadece admin' }, { status: 403 })
    }

    // Foreign key sırasına göre sil
    const tables = [
      'material_measurements',
      'material_quarantine_actions',
      'material_quarantine',
      'material_inspections',
      'material_receipts',
      'quality_measurements',
      'quality_inspections',
      'ncr_records',
      'shipments',
      'vehicle_assemblies',
      'gearbox_part_mappings',
      'stock_movements',
      'material_stock_entries',
    ] as const

    const results: Record<string, string> = {
      attachments: '',
      audit_logs: '',
      gearboxes: '',
      materials: '',
    }

    for (const table of tables) {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
      results[table] = error ? error.message : 'OK'
    }

    const { error: attErr } = await supabase.from('attachments').delete().eq('entity_type', 'gearboxes')
    results.attachments = attErr ? attErr.message : 'OK'

    const { error: auditErr } = await supabase.from('audit_logs').delete().eq('entity_type', 'gearboxes')
    results.audit_logs = auditErr ? auditErr.message : 'OK'

    const { error: gearErr } = await supabase.from('gearboxes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    results.gearboxes = gearErr ? gearErr.message : 'OK'

    const { error: matErr } = await supabase.from('materials').update({ current_stock: 0 }).neq('id', '00000000-0000-0000-0000-000000000000')
    results.materials = matErr ? matErr.message : 'OK'

    const hasErrors = Object.values(results).some(v => v !== 'OK')
    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors ? 'Bazı tablolar temizlenemedi (RLS)' : 'Demo verileri temizlendi',
      results,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Hata oluştu' }, { status: 500 })
  }
}
