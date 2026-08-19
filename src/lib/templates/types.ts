/**
 * MASTER TEMPLATE & UI PAGE TEMPLATE SPECIFICATION TYPES
 * Version: MT v2.0 / PT v1.0
 */

// =============================================================================
// 1. PERMISSION LEGEND CODES
// =============================================================================
export type PermissionCode =
  | 'C' // Create
  | 'R' // Read
  | 'U' // Update
  | 'D' // Delete
  | 'A' // Approve
  | 'X' // Reject
  | 'P' // Process
  | 'V' // Verify
  | 'E' // Export
  | 'I' // Import
  | 'O' // Own data
  | 'S' // Assigned data
  | '-' // No access
  | string; // Composite strings like 'CRUD', 'CRU-S', 'RU-O', 'R-L', etc.

export interface PermissionDefinition {
  code: string;
  name: string;
  description: string;
}

export const PERMISSION_LEGEND: PermissionDefinition[] = [
  { code: 'C', name: 'Create', description: 'Membuat data baru' },
  { code: 'R', name: 'Read', description: 'Melihat/membaca seluruh data' },
  { code: 'U', name: 'Update', description: 'Mengubah/memperbarui data' },
  { code: 'D', name: 'Delete', description: 'Menghapus data' },
  { code: 'A', name: 'Approve', description: 'Menyetujui permohonan/transaksi' },
  { code: 'X', name: 'Reject', description: 'Menolak permohonan/transaksi' },
  { code: 'P', name: 'Process', description: 'Memproses status pekerjaan' },
  { code: 'V', name: 'Verify', description: 'Memverifikasi data/dokumen' },
  { code: 'E', name: 'Export', description: 'Mengekspor data ke file' },
  { code: 'I', name: 'Import', description: 'Mengimpor data dari file' },
  { code: 'O', name: 'Own data', description: 'Hanya mengakses data milik sendiri' },
  { code: 'S', name: 'Assigned data', description: 'Hanya mengakses data yang ditugaskan' },
  { code: '-', name: 'No access', description: 'Tidak memiliki akses sama sekali' },
];

// =============================================================================
// 2. MASTER TEMPLATE SPECIFICATION (MT-01 s/d MT-20)
// =============================================================================
export interface ModuleSection {
  modul: string;
  sections: string[];
}

export interface RoleToModulePermission {
  role: string;
  modul: string;
  permission: PermissionCode;
}

export interface TemplateVariant {
  nama: string;
  deskripsi?: string;
  tambahan: string[];
}

export interface MasterTemplate {
  id: string; // e.g. "MT-01"
  nama: string; // e.g. "Retail & POS"
  deskripsi: string;
  modulDanSection: ModuleSection[];
  roleDefault: string[];
  roleToModule: RoleToModulePermission[];
  workflow: string[];
  variant?: TemplateVariant[];
}

// =============================================================================
// 3. MASTER UI & PAGE TEMPLATE SPECIFICATION (PT-01 s/d PT-15)
// =============================================================================
export interface PageTemplateSection {
  name: string;
  description?: string;
  components?: string[];
}

export interface PageTemplate {
  id: string; // e.g. "PT-01"
  nama: string; // e.g. "Dashboard"
  deskripsi: string;
  struktur: string[];
  defaultComponents: string[];
  sectionsDetail?: PageTemplateSection[];
}

export interface ComponentCategory {
  category: string; // Navigation, Data, Form, Status, Transaction, Service, Healthcare, Business
  components: string[];
}

export interface PageToComponentMapping {
  pageType: string;
  pageTemplateId: string;
  defaultComponents: string[];
}

export interface RoleToPageMappingExample {
  role: string;
  pages: {
    pageName: string;
    pageTemplateId: string;
    sections: string[];
  }[];
}

export interface UIGenerationRule {
  ruleNumber: number;
  title: string;
  ruleText: string;
}

// =============================================================================
// 4. UX PATTERN REGISTRY SPECIFICATION (UX_Reference_Library_v1.0)
// =============================================================================
export type UXPatternCategory =
  | 'Authentication'
  | 'Customer'
  | 'Transaction'
  | 'Operations'
  | 'Data'
  | 'Analytics';

export interface UXPatternInformationPriority {
  primary: string[];
  secondary: string[];
  contextual: string[];
}

export interface UXPattern {
  id: string; // e.g. "UX-CUST-04"
  name: string; // e.g. "Patient Queue / Antrean Mandiri"
  category: UXPatternCategory;
  primaryUser: string;
  userGoal: string;
  businessContext: string;
  informationPriority: UXPatternInformationPriority;
  primaryAction: string[];
  secondaryActions: string[];
  requiredData: string[];
  optionalData?: string[];
  states?: string[];
  uxRules: string[];
  referenceProviders?: string[];
}

