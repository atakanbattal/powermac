#!/bin/bash
# Demo verilerini temizle - Supabase REST API ile
# .env.local'dan URL ve KEY alınır
# NOT: RLS politikaları anon key ile silmeyi engelleyebilir.
# Bu durumda Supabase Dashboard > SQL Editor'da aşağıdaki SQL'i çalıştırın.

set -e
cd "$(dirname "$0")/.."
source .env.local 2>/dev/null || true

URL="${NEXT_PUBLIC_SUPABASE_URL}"
KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "Hata: .env.local'da NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı"
  exit 1
fi

API="${URL}/rest/v1"
H="apikey: ${KEY}"
A="Authorization: Bearer ${KEY}"
HCT="Content-Type: application/json"
HP="Prefer: return=minimal"

# Her tablodan id'leri çek ve tek tek sil (RLS bypass için)
delete_table() {
  local t=$1
  local filter=$2
  local ids
  ids=$(curl -s "${API}/${t}?select=id${filter}" -H "$H" -H "$A" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(' '.join(x['id'] for x in d))" 2>/dev/null)
  if [ -z "$ids" ]; then
    echo "  ✓ $t (zaten boş)"
    return
  fi
  local count=0
  for id in $ids; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${API}/${t}?id=eq.${id}" -H "$H" -H "$A" -H "$HP" 2>/dev/null)
    if [ "$code" = "200" ] || [ "$code" = "204" ]; then
      count=$((count+1))
    fi
  done
  echo "  ✓ $t ($count satır silindi)"
}

echo "Demo verileri temizleniyor..."

delete_table "material_measurements" ""
delete_table "material_quarantine_actions" ""
delete_table "material_quarantine" ""
delete_table "material_inspections" ""
delete_table "material_receipts" ""
delete_table "quality_measurements" ""
delete_table "quality_inspections" ""
delete_table "ncr_records" ""
delete_table "shipments" ""
delete_table "vehicle_assemblies" ""
delete_table "gearbox_part_mappings" ""
delete_table "stock_movements" ""
delete_table "material_stock_entries" ""
delete_table "attachments" "&entity_type=eq.gearboxes"
delete_table "audit_logs" "&entity_type=eq.gearboxes"
delete_table "gearboxes" ""

echo "Malzeme stokları sıfırlanıyor..."
curl -s -X PATCH "${API}/materials?id=neq.00000000-0000-0000-0000-000000000000" \
  -H "$H" -H "$A" -H "$HCT" \
  -d '{"current_stock":0}' >/dev/null 2>&1 && echo "  ✓ materials.current_stock=0" || echo "  ✗ materials güncellenemedi"

echo "Temizlik tamamlandı."
