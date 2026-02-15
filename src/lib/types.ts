// ============================================
// PowerMac - Type Definitions
// ============================================

export type UserRole = 'admin' | 'quality' | 'production' | 'logistics' | 'viewer'
export type GearboxModel = 'A' | 'B' | 'C'
export type GearboxStatus = 'uretimde' | 'final_kontrol_bekliyor' | 'stokta' | 'sevk_edildi' | 'montajlandi' | 'revizyon_iade'
export type MaterialCategory = 'hammadde' | 'komponent' | 'sarf'
export type MaterialUnit = 'adet' | 'kg' | 'lt' | 'm' | 'mm' | 'set'
export type StockMovementType = 'giris' | 'tuketim' | 'duzeltme' | 'fire' | 'iade'
export type NcrStatus = 'acik' | 'analiz' | 'aksiyon' | 'kapandi'
export type InspectionResult = 'ok' | 'ret' | 'beklemede'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  department?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Gearbox {
  id: string
  serial_number: string
  model: GearboxModel
  production_date: string
  sequence_number: number
  status: GearboxStatus
  production_start?: string
  production_end?: string
  responsible_user_id?: string
  bom_revision_id?: string
  work_order?: string
  production_line?: string
  parts_mapping_complete: boolean
  notes?: string
  created_at: string
  updated_at: string
  // Relations
  responsible_user?: Profile
  shipments?: Shipment[]
  vehicle_assemblies?: VehicleAssembly[]
  quality_inspections?: QualityInspection[]
  gearbox_part_mappings?: GearboxPartMapping[]
}

export interface Supplier {
  id: string
  name: string
  code?: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  is_active: boolean
  created_at: string
}

export interface Material {
  id: string
  code: string
  name: string
  description?: string
  category: MaterialCategory
  unit: MaterialUnit
  min_stock: number
  target_stock: number
  current_stock: number
  is_critical: boolean
  default_supplier_id?: string
  notes?: string
  is_active: boolean
  created_at: string
  default_supplier?: Supplier
}

export interface MaterialStockEntry {
  id: string
  material_id: string
  supplier_id?: string
  invoice_number?: string
  lot_number?: string
  quantity: number
  remaining_quantity: number
  entry_date: string
  notes?: string
  created_by?: string
  created_at: string
  material?: Material
  supplier?: Supplier
}

export interface StockMovement {
  id: string
  material_id: string
  stock_entry_id?: string
  gearbox_id?: string
  movement_type: StockMovementType
  quantity: number
  notes?: string
  created_by?: string
  created_at: string
  material?: Material
  gearbox?: Gearbox
}

export interface GearboxPartMapping {
  id: string
  gearbox_id: string
  material_id: string
  stock_entry_id?: string
  quantity: number
  notes?: string
  mapped_by?: string
  mapped_at: string
  material?: Material
  stock_entry?: MaterialStockEntry
}

export interface BomRevision {
  id: string
  model: GearboxModel
  revision_no: number
  description?: string
  is_active: boolean
  effective_date: string
  created_by?: string
  created_at: string
  bom_items?: BomItem[]
}

export interface BomItem {
  id: string
  bom_revision_id: string
  material_id: string
  quantity_per_unit: number
  is_critical: boolean
  alternative_material_id?: string
  notes?: string
  sort_order: number
  material?: Material
  alternative_material?: Material
}

export interface ControlPlanRevision {
  id: string
  model: GearboxModel
  revision_no: number
  description?: string
  is_active: boolean
  effective_date: string
  created_by?: string
  created_at: string
  target_type?: string
  target_name?: string
  material_id?: string
  control_plan_items?: ControlPlanItem[]
}

export interface ControlPlanItem {
  id: string
  control_plan_id: string
  name: string
  characteristic?: string
  nominal_value?: number
  lower_limit?: number
  upper_limit?: number
  unit: string
  measurement_method?: string
  equipment?: string
  is_critical: boolean
  is_100_percent: boolean
  sample_info?: string
  sort_order: number
}

export interface QualityInspection {
  id: string
  gearbox_id: string
  control_plan_id: string
  inspector_id?: string
  inspection_date: string
  overall_result: InspectionResult
  comments?: string
  is_draft: boolean
  created_at: string
  updated_at: string
  gearbox?: Gearbox
  control_plan?: ControlPlanRevision
  inspector?: Profile
  quality_measurements?: QualityMeasurement[]
}

export interface QualityMeasurement {
  id: string
  inspection_id: string
  control_plan_item_id: string
  measured_value?: number
  result: InspectionResult
  notes?: string
  control_plan_item?: ControlPlanItem
}

export interface Shipment {
  id: string
  gearbox_id: string
  shipment_date: string
  customer_name?: string
  delivery_address?: string
  waybill_number?: string
  invoice_number?: string
  notes?: string
  shipped_by?: string
  created_at: string
  gearbox?: Gearbox
}

export interface VehicleAssembly {
  id: string
  gearbox_id: string
  assembly_date?: string
  vehicle_plate?: string
  vin_number?: string
  customer_name?: string
  notes?: string
  recorded_by?: string
  created_at: string
  gearbox?: Gearbox
}

export interface NcrRecord {
  id: string
  gearbox_id?: string
  inspection_id?: string
  ncr_number: string
  status: NcrStatus
  description: string
  root_cause?: string
  corrective_action?: string
  responsible_user_id?: string
  target_date?: string
  closed_date?: string
  closed_by?: string
  created_by?: string
  created_at: string
  gearbox?: Gearbox
  responsible_user?: Profile
}

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: string
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
  user_id?: string
  user_name?: string
  created_at: string
  user?: Profile
}

export interface Attachment {
  id: string
  entity_type: string
  entity_id: string
  file_name: string
  file_path: string
  file_size?: number
  mime_type?: string
  uploaded_by?: string
  created_at: string
}

export interface SystemSetting {
  id: string
  key: string
  value: Record<string, unknown>
  description?: string
  updated_at: string
}

// Dashboard types
export interface DashboardStats {
  monthlyProduction: { model: GearboxModel; count: number }[]
  monthlyShipments: { model: GearboxModel; count: number }[]
  currentStock: { model: GearboxModel; count: number }[]
  statusDistribution: { status: GearboxStatus; count: number }[]
  criticalMaterials: Material[]
  recentActivity: AuditLog[]
}
