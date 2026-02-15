import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { production_date, model } = await request.json()

    if (!production_date || !model) {
      return NextResponse.json({ error: 'Tarih ve model gerekli' }, { status: 400 })
    }

    // Concurrency-safe seri no üretimi: DB fonksiyonu kullan
    const { data, error } = await supabase.rpc('generate_serial_number', {
      p_production_date: production_date,
      p_model: model,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data?.[0] || data
    return NextResponse.json({
      serial_number: result.serial_number,
      sequence_number: result.sequence_number,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Seri no üretilemedi' }, { status: 500 })
  }
}
