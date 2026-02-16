-- Bitmiş ürün stok silme sorununu çözmek için 'hurdaya' durumu eklenir.
-- Silme işlemi artık soft-delete (status güncellemesi) olarak yapılıyor.
-- Supabase Dashboard > SQL Editor'da çalıştırın:

ALTER TYPE public.gearbox_status ADD VALUE 'hurdaya';
