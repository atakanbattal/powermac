-- Demo verilerini temizle (tesellüm + üretim)
-- Foreign key sırasına göre sil (child -> parent)

DELETE FROM material_measurements;
DELETE FROM quality_measurements;
DELETE FROM quality_inspections;
DELETE FROM ncr_records;
DELETE FROM shipments;
DELETE FROM vehicle_assemblies;
DELETE FROM gearbox_part_mappings;      -- references material_stock_entries
DELETE FROM stock_movements;            -- references material_stock_entries
DELETE FROM material_stock_entries;     -- references material_quarantine (quarantine_id)
DELETE FROM material_quarantine_actions; -- references material_quarantine
DELETE FROM material_quarantine;         -- references material_inspections, material_receipts
DELETE FROM material_inspections;
DELETE FROM material_receipts;           -- material_quarantine'den sonra silinmeli (receipt_id fk)
DELETE FROM attachments WHERE entity_type = 'gearboxes';
DELETE FROM audit_logs WHERE entity_type = 'gearboxes';
DELETE FROM gearboxes;
UPDATE materials SET current_stock = 0;
