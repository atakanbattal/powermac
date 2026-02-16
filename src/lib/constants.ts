import { GearboxStatus, GearboxModel, MaterialCategory, UserRole } from './types'

export const STATUS_LABELS: Record<GearboxStatus, string> = {
  uretimde: 'Üretimde',
  final_kontrol_bekliyor: 'Kontrol Bekliyor',
  stokta: 'Stokta',
  sevk_edildi: 'Sevk Edildi',
  montajlandi: 'Montajlandı',
  revizyon_iade: 'Revizyon/İade',
  hurdaya: 'Hurdaya',
}

export const STATUS_COLORS: Record<GearboxStatus, string> = {
  uretimde: 'bg-blue-100 text-blue-700 border-blue-200',
  final_kontrol_bekliyor: 'bg-amber-100 text-amber-700 border-amber-200',
  stokta: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sevk_edildi: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  montajlandi: 'bg-purple-100 text-purple-700 border-purple-200',
  revizyon_iade: 'bg-red-100 text-red-700 border-red-200',
  hurdaya: 'bg-slate-100 text-slate-500 border-slate-200',
}

const DEFAULT_MODEL_LABELS: Record<string, string> = {
  A: 'Model A',
  B: 'Model B',
  C: 'Model C',
}
export const MODEL_LABELS: Record<string, string> = { ...DEFAULT_MODEL_LABELS }

export function getModelLabel(code: string, models?: { code: string; name: string }[]): string {
  if (models) {
    const m = models.find(x => x.code === code)
    if (m) return m.name
  }
  return DEFAULT_MODEL_LABELS[code] ?? `Model ${code}`
}

const DEFAULT_MODEL_COLORS: Record<string, string> = {
  A: '#3b82f6',
  B: '#10b981',
  C: '#f59e0b',
}
export const MODEL_COLORS: Record<string, string> = DEFAULT_MODEL_COLORS

export function getModelColor(code: string): string {
  return DEFAULT_MODEL_COLORS[code] ?? '#6b7280'
}

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  hammadde: 'Hammadde',
  komponent: 'Komponent/Parça',
  sarf: 'Sarf Malzeme',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Yönetici',
  quality: 'Kalite',
  production: 'Üretim',
  logistics: 'Lojistik',
  viewer: 'İzleyici',
}

export const ALLOWED_TRANSITIONS: Record<GearboxStatus, GearboxStatus[]> = {
  uretimde: ['final_kontrol_bekliyor'],
  final_kontrol_bekliyor: ['stokta', 'revizyon_iade'],
  stokta: ['sevk_edildi'],
  sevk_edildi: ['montajlandi'],
  revizyon_iade: ['final_kontrol_bekliyor', 'uretimde'],
  montajlandi: [],
  hurdaya: [],
}

export const NAV_ITEMS = [
  { href: '/', label: 'Anasayfa', icon: 'LayoutDashboard' },
  { href: '/bom', label: 'BOM / Reçete', icon: 'FileText' },
  { href: '/kontrol-plani', label: 'Kontrol Planları', icon: 'ClipboardList' },
  { href: '/tesellum', label: 'Tesellüm', icon: 'Receipt' },
  { href: '/girdi-kontrol', label: 'Girdi Kontrol', icon: 'ClipboardList' },
  { href: '/malzeme', label: 'Malzeme & Stok', icon: 'Package' },
  { href: '/uretim', label: 'Üretim', icon: 'Factory' },
  { href: '/kalite-kontrol', label: 'Final Kalite Kontrol', icon: 'ShieldCheck' },
  { href: '/bitimis-urun-stok', label: 'Bitmiş Ürün Stok', icon: 'PackageCheck' },
  { href: '/sevkiyat', label: 'Sevkiyat', icon: 'Truck' },
  { href: '/izlenebilirlik', label: 'İzlenebilirlik', icon: 'Search' },
  { href: '/ayarlar', label: 'Ayarlar', icon: 'Settings' },
]
