import { redirect } from 'next/navigation'

export default async function KaliteKontrolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Şimdilik kalite kontrol listesine yönlendir
  // İleride detay sayfası eklenebilir
  redirect('/kalite-kontrol')
}
