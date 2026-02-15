import { GearboxStatus, GearboxModel, MaterialCategory, NcrStatus, UserRole } from './types'

export const STATUS_LABELS: Record<GearboxStatus, string> = {
  uretimde: 'Üretimde',
  final_kontrol_bekliyor: 'Kontrol Bekliyor',
  stokta: 'Stokta',
  sevk_edildi: 'Sevk Edildi',
  montajlandi: 'Montajlandı',
  revizyon_iade: 'Revizyon/İade',
}

export const STATUS_COLORS: Record<GearboxStatus, string> = {
  uretimde: 'bg-blue-100 text-blue-700 border-blue-200',
  final_kontrol_bekliyor: 'bg-amber-100 text-amber-700 border-amber-200',
  stokta: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sevk_edildi: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  montajlandi: 'bg-purple-100 text-purple-700 border-purple-200',
  revizyon_iade: 'bg-red-100 text-red-700 border-red-200',
}

export const MODEL_LABELS: Record<GearboxModel, string> = {
  A: 'Model A',
  B: 'Model B',
  C: 'Model C',
}

export const MODEL_COLORS: Record<GearboxModel, string> = {
  A: '#3b82f6',
  B: '#10b981',
  C: '#f59e0b',
}

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  hammadde: 'Hammadde',
  komponent: 'Komponent/Parça',
  sarf: 'Sarf Malzeme',
}

export const NCR_STATUS_LABELS: Record<NcrStatus, string> = {
  acik: 'Açık',
  analiz: 'Analiz',
  aksiyon: 'Aksiyon',
  kapandi: 'Kapandı',
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
}

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/uretim', label: 'Üretim', icon: 'Factory' },
  { href: '/malzeme', label: 'Malzeme & Stok', icon: 'Package' },
  { href: '/bom', label: 'BOM / Reçete', icon: 'FileText' },
  { href: '/kalite-kontrol', label: 'Kalite Kontrol', icon: 'ShieldCheck' },
  { href: '/sevkiyat', label: 'Sevkiyat', icon: 'Truck' },
  { href: '/izlenebilirlik', label: 'İzlenebilirlik', icon: 'Search' },
  { href: '/ncr', label: 'Uygunsuzluk (NCR)', icon: 'AlertTriangle' },
  { href: '/ayarlar', label: 'Ayarlar', icon: 'Settings' },
]
