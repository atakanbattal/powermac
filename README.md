# PowerMac - Şanzıman Üretim Yönetim Sistemi

Şanzıman üretim takibi, kalite kontrol ve uçtan uca izlenebilirlik sistemi.

## Teknoloji

- **Frontend:** Next.js 16 (App Router) + React + TypeScript
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Storage + RLS)
- **Grafik:** Recharts
- **Form:** React Hook Form + Zod
- **Deploy:** Netlify

## Özellikler

- **Şanzıman Üretim Takibi:** Otomatik seri no üretimi (DDMMYY-MODEL-SIRA), durum yönetimi
- **Malzeme & Stok Yönetimi:** Parça girişi, irsaliye/lot takibi, tedarikçi yönetimi
- **BOM / Reçete:** Model bazlı malzeme listesi, revizyon yönetimi
- **Parça Eşleştirme:** Şanzıman-parça ilişkilendirme, kitting kontrolü
- **Kontrol Planı:** Model bazlı ölçüm tanımları, revizyon yönetimi
- **Final Kalite Kontrol:** Ölçüm girişi, otomatik tolerans değerlendirme, OK/RET
- **Sevkiyat & Montaj:** Sevk bilgileri, araç montaj (plaka/VIN) kayıtları
- **İzlenebilirlik:** Seri no, VIN, plaka, irsaliye ile kapsamlı arama
- **NCR:** RET sonuçlarından otomatik uygunsuzluk kaydı
- **Audit Trail:** Tüm kritik değişikliklerin izlenmesi
- **Dashboard:** Üretim/sevkiyat/stok grafikleri, kritik stok uyarıları

## Kurulum

### Gereksinimler

- Node.js 20+
- npm
- Supabase hesabı

### Yerel Geliştirme

```bash
# Bağımlılıkları kur
npm install

# Ortam değişkenlerini ayarla
cp .env.example .env.local
# .env.local dosyasını düzenleyin

# Geliştirme sunucusu
npm run dev
```

### Ortam Değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL'i |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

## Demo Kullanıcılar

| E-posta | Şifre | Rol |
|---------|-------|-----|
| admin@powermac.com | PowerMac2024! | Yönetici (Admin) |
| kalite@powermac.com | PowerMac2024! | Kalite |
| uretim@powermac.com | PowerMac2024! | Üretim |
| lojistik@powermac.com | PowerMac2024! | Lojistik |

## Seri Numarası Formatı

```
DDMMYY-MODEL-SIRA
Örnek: 150226-A-01, 150226-B-03
```

- **DDMMYY:** Üretim tarihi
- **MODEL:** A, B veya C
- **SIRA:** Aynı gün ve model için otomatik artan (01, 02...)

## Netlify Deploy

```bash
# Build
npm run build

# Netlify CLI ile deploy
netlify deploy --prod
```

### Netlify Ayarları

- **Build command:** `npm run build`
- **Publish directory:** `.next`
- **Node version:** 20
- **Environment variables:** Yukarıdaki ortam değişkenlerini Netlify dashboard'dan ekleyin

## Veritabanı Şeması

20+ tablo ile ilişkisel tasarım:

- `profiles` - Kullanıcı profilleri ve rolleri
- `gearboxes` - Şanzıman üretim kayıtları
- `materials` - Malzeme tanımları
- `material_stock_entries` - Stok giriş kayıtları
- `gearbox_part_mappings` - Şanzıman-parça eşleştirmeleri
- `bom_revisions` / `bom_items` - Ürün reçeteleri
- `control_plan_revisions` / `control_plan_items` - Kontrol planları
- `quality_inspections` / `quality_measurements` - Kalite kontrol
- `shipments` - Sevkiyat kayıtları
- `vehicle_assemblies` - Araç montaj bilgileri
- `ncr_records` - Uygunsuzluk kayıtları
- `audit_logs` - Denetim izi
- `stock_movements` - Stok hareketleri
- `attachments` - Dosya ekleri
- `system_settings` - Sistem ayarları

## Yetkilendirme (RLS)

| Modül | Admin | Kalite | Üretim | Lojistik | İzleyici |
|-------|-------|--------|--------|----------|----------|
| Şanzıman CRUD | ✅ | ❌ | ✅ | ❌ | ❌ |
| Kalite Kontrol | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kontrol Planı | ✅ | ✅ | ❌ | ❌ | ❌ |
| Sevkiyat | ✅ | ❌ | ❌ | ✅ | ❌ |
| Malzeme | ✅ | ❌ | ✅ | ❌ | ❌ |
| BOM | ✅ | ❌ | ✅ | ❌ | ❌ |
| Okuma (Tümü) | ✅ | ✅ | ✅ | ✅ | ✅ |

## Lisans

Özel kullanım - PowerMac
