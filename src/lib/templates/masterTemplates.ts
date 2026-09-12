/**
 * MASTER TEMPLATES REGISTRY (MT-01 s/d MT-21)
 * Version: 2.0
 * Status: Structured Specification Data
 */

import { MasterTemplate } from './types';
import { ensureRequiredSystemRole, normalizeRoleName, REQUIRED_SYSTEM_ROLE } from '../rolePolicy';

export const MASTER_TEMPLATES: MasterTemplate[] = [
  // ===========================================================================
  // MT-01 — Retail & POS
  // ===========================================================================
  {
    id: 'MT-01',
    nama: 'Retail & POS',
    deskripsi: 'Blueprint aplikasi ritel, toko, kasir POS, manajemen stok barang, dan laporan penjualan.',
    modulDanSection: [
      {
        modul: 'Products',
        sections: ['Product List', 'Product Detail', 'Category', 'Price', 'SKU / Barcode', 'Product Status']
      },
      {
        modul: 'Customers',
        sections: ['Customer List', 'Customer Profile', 'Customer History', 'Customer Balance']
      },
      {
        modul: 'Suppliers',
        sections: ['Supplier List', 'Supplier Profile', 'Supplier History']
      },
      {
        modul: 'Inventory',
        sections: ['Stock Overview', 'Stock Movement', 'Stock Adjustment', 'Stock Opname', 'Stock Transfer']
      },
      {
        modul: 'Purchasing',
        sections: ['Purchase Request', 'Purchase Order', 'Receiving', 'Purchase History']
      },
      {
        modul: 'Sales',
        sections: ['POS', 'Sales Order', 'Sales Detail', 'Discount', 'Return', 'Sales History']
      },
      {
        modul: 'Payments',
        sections: ['Payment', 'Payment Method', 'Refund', 'Payment History']
      },
      {
        modul: 'Expenses',
        sections: ['Expense Entry', 'Expense Category', 'Expense History']
      },
      {
        modul: 'Reports',
        sections: ['Sales Report', 'Inventory Report', 'Purchase Report', 'Customer Report', 'Profit Report']
      }
    ],
    roleDefault: ['Owner', 'Manager', 'Admin', 'Cashier', 'Sales', 'Warehouse', 'Purchasing', 'Customer'],
    adminRoleGuidance: 'Untuk skala UMKM / toko ritel standar, konsolidasikan Owner, Manager, dan Admin menjadi 1 role "Admin" (atau "Owner") saja untuk kelola akun kasir/staf, master data produk & harga. Pisahkan menjadi Owner + Manager HANYA jika pengguna eksplisit meminta struktur multi-cabang atau hierarki manajemen terpisah.',
    roleToModule: [
      { role: 'Owner', modul: 'Products', permission: 'CRUD' },
      { role: 'Owner', modul: 'Customers', permission: 'CRUD' },
      { role: 'Owner', modul: 'Suppliers', permission: 'CRUD' },
      { role: 'Owner', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Owner', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Owner', modul: 'Sales', permission: 'CRUD' },
      { role: 'Owner', modul: 'Payments', permission: 'CRUD' },
      { role: 'Owner', modul: 'Expenses', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },

      { role: 'Manager', modul: 'Products', permission: 'CRUD' },
      { role: 'Manager', modul: 'Customers', permission: 'CRUD' },
      { role: 'Manager', modul: 'Suppliers', permission: 'CRUD' },
      { role: 'Manager', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Manager', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Manager', modul: 'Sales', permission: 'CRUD' },
      { role: 'Manager', modul: 'Payments', permission: 'CRUD' },
      { role: 'Manager', modul: 'Expenses', permission: 'CRU' },
      { role: 'Manager', modul: 'Reports', permission: 'R' },

      { role: 'Admin', modul: 'Products', permission: 'CRUD' },
      { role: 'Admin', modul: 'Customers', permission: 'CRUD' },
      { role: 'Admin', modul: 'Suppliers', permission: 'CRUD' },
      { role: 'Admin', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Admin', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Admin', modul: 'Sales', permission: 'CRUD' },
      { role: 'Admin', modul: 'Payments', permission: 'CRUD' },
      { role: 'Admin', modul: 'Expenses', permission: 'CRUD' },
      { role: 'Admin', modul: 'Reports', permission: 'R' },

      { role: 'Cashier', modul: 'Products', permission: 'R' },
      { role: 'Cashier', modul: 'Customers', permission: 'CR' },
      { role: 'Cashier', modul: 'Suppliers', permission: '-' },
      { role: 'Cashier', modul: 'Inventory', permission: 'R' },
      { role: 'Cashier', modul: 'Purchasing', permission: '-' },
      { role: 'Cashier', modul: 'Sales', permission: 'CRU' },
      { role: 'Cashier', modul: 'Payments', permission: 'CRU' },
      { role: 'Cashier', modul: 'Expenses', permission: '-' },
      { role: 'Cashier', modul: 'Reports', permission: 'R-L' },

      { role: 'Sales', modul: 'Products', permission: 'R' },
      { role: 'Sales', modul: 'Customers', permission: 'CRU' },
      { role: 'Sales', modul: 'Suppliers', permission: '-' },
      { role: 'Sales', modul: 'Inventory', permission: 'R' },
      { role: 'Sales', modul: 'Purchasing', permission: '-' },
      { role: 'Sales', modul: 'Sales', permission: 'CRU' },
      { role: 'Sales', modul: 'Payments', permission: 'R' },
      { role: 'Sales', modul: 'Expenses', permission: '-' },
      { role: 'Sales', modul: 'Reports', permission: 'R-L' },

      { role: 'Warehouse', modul: 'Products', permission: 'R' },
      { role: 'Warehouse', modul: 'Customers', permission: 'R' },
      { role: 'Warehouse', modul: 'Suppliers', permission: 'R' },
      { role: 'Warehouse', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Warehouse', modul: 'Purchasing', permission: 'R' },
      { role: 'Warehouse', modul: 'Sales', permission: 'R' },
      { role: 'Warehouse', modul: 'Payments', permission: '-' },
      { role: 'Warehouse', modul: 'Expenses', permission: '-' },
      { role: 'Warehouse', modul: 'Reports', permission: 'R-L' },

      { role: 'Purchasing', modul: 'Products', permission: 'R' },
      { role: 'Purchasing', modul: 'Customers', permission: 'R' },
      { role: 'Purchasing', modul: 'Suppliers', permission: 'CRUD' },
      { role: 'Purchasing', modul: 'Inventory', permission: 'CR' },
      { role: 'Purchasing', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Purchasing', modul: 'Sales', permission: 'R' },
      { role: 'Purchasing', modul: 'Payments', permission: 'R' },
      { role: 'Purchasing', modul: 'Expenses', permission: 'CR' },
      { role: 'Purchasing', modul: 'Reports', permission: 'R-L' },

      { role: 'Customer', modul: 'Products', permission: 'R' },
      { role: 'Customer', modul: 'Customers', permission: 'RU-O' },
      { role: 'Customer', modul: 'Suppliers', permission: '-' },
      { role: 'Customer', modul: 'Inventory', permission: 'R' },
      { role: 'Customer', modul: 'Purchasing', permission: '-' },
      { role: 'Customer', modul: 'Sales', permission: 'CR-O' },
      { role: 'Customer', modul: 'Payments', permission: 'CR-O' },
      { role: 'Customer', modul: 'Expenses', permission: '-' },
      { role: 'Customer', modul: 'Reports', permission: 'R-O' }
    ],
    workflow: [
      'Purchase Request → Approval → Purchase Order → Receiving → Inventory',
      'Customer → Sales Order → Payment → Completed',
      'Sales Return → Request → Verification → Approval → Stock Adjustment → Refund'
    ]
  },

  // ===========================================================================
  // MT-02 — Wholesale & Distribution
  // ===========================================================================
  {
    id: 'MT-02',
    nama: 'Wholesale & Distribution',
    deskripsi: 'Blueprint grosir, distributor, fulfillment gudang, picking, packing, pengiriman armada, dan piutang.',
    modulDanSection: [
      {
        modul: 'Products',
        sections: ['Product Catalog', 'SKU', 'Price Tier', 'Customer Price', 'Product Category']
      },
      {
        modul: 'Customers',
        sections: ['Customer', 'Customer Group', 'Credit Limit', 'Receivable']
      },
      {
        modul: 'Suppliers',
        sections: ['Supplier', 'Supplier Contract', 'Purchase History']
      },
      {
        modul: 'Sales',
        sections: ['Quotation', 'Sales Order', 'Sales Invoice', 'Sales Return']
      },
      {
        modul: 'Purchasing',
        sections: ['Purchase Request', 'Purchase Order', 'Receiving', 'Purchase Return']
      },
      {
        modul: 'Warehouse',
        sections: ['Warehouse', 'Bin / Location', 'Stock', 'Stock Transfer', 'Stock Opname']
      },
      {
        modul: 'Fulfillment',
        sections: ['Picking', 'Checking', 'Packing', 'Delivery']
      },
      {
        modul: 'Finance',
        sections: ['Receivable', 'Payable', 'Payment']
      },
      {
        modul: 'Reports',
        sections: ['Sales', 'Inventory', 'Receivable', 'Purchase', 'Delivery']
      }
    ],
    roleDefault: ['Owner', 'Manager', 'Sales', 'Sales Admin', 'Purchasing', 'Warehouse', 'Picker', 'Checker', 'Driver', 'Finance', 'Customer'],
    adminRoleGuidance: 'Untuk skala distributor menengah, gabung Owner dan Manager menjadi 1 role "Admin" / "Manajer Operasional". Pisahkan jika pengguna eksplisit meminta kontrol kepemilikan terpisah dari pengawasan gudang.',
    roleToModule: [
      { role: 'Owner', modul: 'Products', permission: 'CRUD' },
      { role: 'Owner', modul: 'Customers', permission: 'CRUD' },
      { role: 'Owner', modul: 'Suppliers', permission: 'CRUD' },
      { role: 'Owner', modul: 'Sales', permission: 'CRUD' },
      { role: 'Owner', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Owner', modul: 'Warehouse', permission: 'CRUD' },
      { role: 'Owner', modul: 'Fulfillment', permission: 'CRUD' },
      { role: 'Owner', modul: 'Finance', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },

      { role: 'Manager', modul: 'Products', permission: 'CRUD' },
      { role: 'Manager', modul: 'Customers', permission: 'CRUD' },
      { role: 'Manager', modul: 'Suppliers', permission: 'CRUD' },
      { role: 'Manager', modul: 'Sales', permission: 'CRUD' },
      { role: 'Manager', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Manager', modul: 'Warehouse', permission: 'CRUD' },
      { role: 'Manager', modul: 'Fulfillment', permission: 'CRUD' },
      { role: 'Manager', modul: 'Finance', permission: 'CRUD' },
      { role: 'Manager', modul: 'Reports', permission: 'R' },

      { role: 'Sales', modul: 'Products', permission: 'R' },
      { role: 'Sales', modul: 'Customers', permission: 'CRU' },
      { role: 'Sales', modul: 'Suppliers', permission: '-' },
      { role: 'Sales', modul: 'Sales', permission: 'CRUD' },
      { role: 'Sales', modul: 'Purchasing', permission: '-' },
      { role: 'Sales', modul: 'Warehouse', permission: 'R' },
      { role: 'Sales', modul: 'Fulfillment', permission: 'R' },
      { role: 'Sales', modul: 'Finance', permission: 'R' },
      { role: 'Sales', modul: 'Reports', permission: 'R-L' },

      { role: 'Sales Admin', modul: 'Products', permission: 'R' },
      { role: 'Sales Admin', modul: 'Customers', permission: 'CRUD' },
      { role: 'Sales Admin', modul: 'Suppliers', permission: 'R' },
      { role: 'Sales Admin', modul: 'Sales', permission: 'CRUD' },
      { role: 'Sales Admin', modul: 'Purchasing', permission: '-' },
      { role: 'Sales Admin', modul: 'Warehouse', permission: 'R' },
      { role: 'Sales Admin', modul: 'Fulfillment', permission: 'R' },
      { role: 'Sales Admin', modul: 'Finance', permission: 'R' },
      { role: 'Sales Admin', modul: 'Reports', permission: 'R-L' },

      { role: 'Purchasing', modul: 'Products', permission: 'R' },
      { role: 'Purchasing', modul: 'Customers', permission: 'R' },
      { role: 'Purchasing', modul: 'Suppliers', permission: 'CRUD' },
      { role: 'Purchasing', modul: 'Sales', permission: 'R' },
      { role: 'Purchasing', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Purchasing', modul: 'Warehouse', permission: 'R' },
      { role: 'Purchasing', modul: 'Fulfillment', permission: '-' },
      { role: 'Purchasing', modul: 'Finance', permission: 'R' },
      { role: 'Purchasing', modul: 'Reports', permission: 'R-L' },

      { role: 'Warehouse', modul: 'Products', permission: 'R' },
      { role: 'Warehouse', modul: 'Customers', permission: 'R' },
      { role: 'Warehouse', modul: 'Suppliers', permission: 'R' },
      { role: 'Warehouse', modul: 'Sales', permission: 'R' },
      { role: 'Warehouse', modul: 'Purchasing', permission: 'CRU' },
      { role: 'Warehouse', modul: 'Warehouse', permission: 'CRUD' },
      { role: 'Warehouse', modul: 'Fulfillment', permission: 'CRUD' },
      { role: 'Warehouse', modul: 'Finance', permission: 'R' },
      { role: 'Warehouse', modul: 'Reports', permission: 'R-L' },

      { role: 'Picker', modul: 'Fulfillment', permission: 'RU-S' },
      { role: 'Picker', modul: 'Warehouse', permission: 'RU-S' },
      { role: 'Checker', modul: 'Fulfillment', permission: 'RU-S' },
      { role: 'Checker', modul: 'Warehouse', permission: 'RU-S' },
      { role: 'Driver', modul: 'Fulfillment', permission: 'RU-S' },
      { role: 'Finance', modul: 'Finance', permission: 'CRUD' },
      { role: 'Finance', modul: 'Reports', permission: 'R' },
      { role: 'Customer', modul: 'Customers', permission: 'RU-O' },
      { role: 'Customer', modul: 'Sales', permission: 'CR-O' },
      { role: 'Customer', modul: 'Fulfillment', permission: 'R-O' },
      { role: 'Customer', modul: 'Finance', permission: 'R-O' }
    ],
    workflow: [
      'Sales Order → Credit Check → Stock Check → Picking → Checking → Packing → Delivery → Invoice → Payment',
      'Purchase Request → Approval → Purchase Order → Receiving → Checking → Warehouse'
    ]
  },

  // ===========================================================================
  // MT-03 — F&B & Restaurant
  // ===========================================================================
  {
    id: 'MT-03',
    nama: 'F&B & Restaurant',
    deskripsi: 'Blueprint restoran, kafe, manajemen meja, antrean dapur (KDS), resep, dan HPP/Food Cost.',
    modulDanSection: [
      { modul: 'Menu', sections: ['Menu List', 'Category', 'Price', 'Modifier', 'Availability'] },
      { modul: 'Tables', sections: ['Table List', 'Table Status', 'Floor / Area'] },
      { modul: 'Orders', sections: ['Order Entry', 'Order Detail', 'Discount', 'Split Bill', 'Order History'] },
      { modul: 'Kitchen', sections: ['Kitchen Queue', 'Preparation', 'Ready', 'Completed'] },
      { modul: 'Recipe', sections: ['Recipe', 'Ingredients', 'Portion', 'Food Cost'] },
      { modul: 'Inventory', sections: ['Ingredients', 'Stock', 'Stock Movement', 'Stock Opname'] },
      { modul: 'Purchasing', sections: ['Supplier', 'Purchase Order', 'Receiving'] },
      { modul: 'Payments', sections: ['Payment', 'Payment Method', 'Refund'] },
      { modul: 'Reports', sections: ['Sales', 'Menu Performance', 'Food Cost', 'Inventory', 'Staff'] }
    ],
    roleDefault: ['Owner', 'Manager', 'Cashier', 'Waiter', 'Kitchen', 'Barista', 'Warehouse', 'Purchasing', 'Finance', 'Customer'],
    adminRoleGuidance: 'Untuk cafe/resto/warung skala standar, gabung Owner dan Manager menjadi 1 role "Admin/Owner" untuk kelola menu, harga, dan akun staf. Pisahkan jadi Owner + Manager HANYA jika user eksplisit meminta cabang/franchise atau pembukuan investor.',
    roleToModule: [
      { role: 'Owner', modul: 'Menu', permission: 'CRUD' },
      { role: 'Owner', modul: 'Tables', permission: 'CRUD' },
      { role: 'Owner', modul: 'Orders', permission: 'CRUD' },
      { role: 'Owner', modul: 'Kitchen', permission: 'CRUD' },
      { role: 'Owner', modul: 'Recipe', permission: 'CRUD' },
      { role: 'Owner', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Owner', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Owner', modul: 'Payments', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },

      { role: 'Manager', modul: 'Menu', permission: 'CRUD' },
      { role: 'Manager', modul: 'Tables', permission: 'CRUD' },
      { role: 'Manager', modul: 'Orders', permission: 'CRUD' },
      { role: 'Manager', modul: 'Kitchen', permission: 'CRUD' },
      { role: 'Manager', modul: 'Recipe', permission: 'CRUD' },
      { role: 'Manager', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Manager', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Manager', modul: 'Payments', permission: 'CRUD' },
      { role: 'Manager', modul: 'Reports', permission: 'R' },

      { role: 'Cashier', modul: 'Menu', permission: 'R' },
      { role: 'Cashier', modul: 'Tables', permission: 'CRUD' },
      { role: 'Cashier', modul: 'Orders', permission: 'CRUD' },
      { role: 'Cashier', modul: 'Kitchen', permission: 'R' },
      { role: 'Cashier', modul: 'Payments', permission: 'CRUD' },
      { role: 'Cashier', modul: 'Reports', permission: 'R-L' },

      { role: 'Waiter', modul: 'Menu', permission: 'R' },
      { role: 'Waiter', modul: 'Tables', permission: 'RU' },
      { role: 'Waiter', modul: 'Orders', permission: 'CRU-S' },
      { role: 'Waiter', modul: 'Kitchen', permission: 'CRU-S' },
      { role: 'Waiter', modul: 'Payments', permission: 'CR' },

      { role: 'Kitchen', modul: 'Menu', permission: 'R' },
      { role: 'Kitchen', modul: 'Tables', permission: 'R' },
      { role: 'Kitchen', modul: 'Orders', permission: 'R-U-S' },
      { role: 'Kitchen', modul: 'Kitchen', permission: 'CRUD' },
      { role: 'Kitchen', modul: 'Recipe', permission: 'R' },
      { role: 'Kitchen', modul: 'Inventory', permission: 'R' },

      { role: 'Barista', modul: 'Kitchen', permission: 'CRU-S' },
      { role: 'Barista', modul: 'Orders', permission: 'CRU-S' },
      { role: 'Warehouse', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Purchasing', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Finance', modul: 'Payments', permission: 'CRUD' },
      { role: 'Finance', modul: 'Reports', permission: 'R' },
      { role: 'Customer', modul: 'Menu', permission: 'R' },
      { role: 'Customer', modul: 'Orders', permission: 'CR-O' },
      { role: 'Customer', modul: 'Payments', permission: 'CR-O' }
    ],
    workflow: [
      'Order → Kitchen / Bar → Preparation → Ready → Served → Payment → Completed'
    ]
  },

  // ===========================================================================
  // MT-04 — Appointment & Service
  // ===========================================================================
  {
    id: 'MT-04',
    nama: 'Appointment & Service',
    deskripsi: 'Blueprint layanan berbasis janji temu, antrean pelanggan, jadwal staf/terapis, dan komisi layanan.',
    modulDanSection: [
      {
        modul: 'Customers',
        sections: ['Customer List', 'Customer Profile', 'Customer History', 'Membership']
      },
      {
        modul: 'Services',
        sections: ['Service Catalog', 'Category', 'Price', 'Duration', 'Package']
      },
      {
        modul: 'Staff',
        sections: ['Staff Profile', 'Skill', 'Schedule', 'Commission', 'Performance']
      },
      {
        modul: 'Appointment',
        sections: ['Calendar', 'Booking', 'Reschedule', 'Cancel', 'Check-in', 'Staff Assignment', 'History']
      },
      {
        modul: 'Queue',
        sections: ['Queue List', 'Calling', 'Serving', 'Completed']
      },
      {
        modul: 'Transaction',
        sections: ['Service Transaction', 'Service Item', 'Discount', 'Tax', 'History']
      },
      {
        modul: 'Payment',
        sections: ['Payment', 'Payment Method', 'Refund', 'History']
      },
      {
        modul: 'Reports',
        sections: ['Sales', 'Appointment', 'Staff', 'Customer', 'Revenue']
      }
    ],
    roleDefault: ['Owner', 'Manager', 'Receptionist', 'Service Staff', 'Cashier', 'Customer'],
    adminRoleGuidance: 'Untuk jasa/laundry/salon skala standar, gabung Owner dan Manager menjadi 1 role "Admin" (atau "Owner") untuk pantau transaksi, kelola staf, dan tarif paket. Pisahkan HANYA jika pengguna meminta struktur multi-outlet.',
    roleToModule: [
      { role: 'Owner', modul: 'Customers', permission: 'CRUD' },
      { role: 'Owner', modul: 'Services', permission: 'CRUD' },
      { role: 'Owner', modul: 'Staff', permission: 'CRUD' },
      { role: 'Owner', modul: 'Appointment', permission: 'CRUD' },
      { role: 'Owner', modul: 'Queue', permission: 'CRUD' },
      { role: 'Owner', modul: 'Transaction', permission: 'CRUD' },
      { role: 'Owner', modul: 'Payment', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },

      { role: 'Manager', modul: 'Customers', permission: 'CRUD' },
      { role: 'Manager', modul: 'Services', permission: 'CRUD' },
      { role: 'Manager', modul: 'Staff', permission: 'CRUD' },
      { role: 'Manager', modul: 'Appointment', permission: 'CRUD' },
      { role: 'Manager', modul: 'Queue', permission: 'CRUD' },
      { role: 'Manager', modul: 'Transaction', permission: 'CRUD' },
      { role: 'Manager', modul: 'Payment', permission: 'CRUD' },
      { role: 'Manager', modul: 'Reports', permission: 'R' },

      { role: 'Receptionist', modul: 'Customers', permission: 'CRUD' },
      { role: 'Receptionist', modul: 'Services', permission: 'R' },
      { role: 'Receptionist', modul: 'Staff', permission: 'R' },
      { role: 'Receptionist', modul: 'Appointment', permission: 'CRUD' },
      { role: 'Receptionist', modul: 'Queue', permission: 'CRUD' },
      { role: 'Receptionist', modul: 'Transaction', permission: 'CR' },
      { role: 'Receptionist', modul: 'Payment', permission: 'CR' },
      { role: 'Receptionist', modul: 'Reports', permission: 'R-L' },

      { role: 'Service Staff', modul: 'Customers', permission: 'R' },
      { role: 'Service Staff', modul: 'Services', permission: 'R' },
      { role: 'Service Staff', modul: 'Staff', permission: 'R-O' },
      { role: 'Service Staff', modul: 'Appointment', permission: 'RU-S' },
      { role: 'Service Staff', modul: 'Queue', permission: 'RU-S' },
      { role: 'Service Staff', modul: 'Transaction', permission: 'CRU-S' },
      { role: 'Service Staff', modul: 'Payment', permission: 'R' },
      { role: 'Service Staff', modul: 'Reports', permission: 'R-O' },

      { role: 'Cashier', modul: 'Customers', permission: 'CR' },
      { role: 'Cashier', modul: 'Services', permission: 'R' },
      { role: 'Cashier', modul: 'Staff', permission: 'R' },
      { role: 'Cashier', modul: 'Appointment', permission: 'R' },
      { role: 'Cashier', modul: 'Queue', permission: 'R' },
      { role: 'Cashier', modul: 'Transaction', permission: 'CRUD' },
      { role: 'Cashier', modul: 'Payment', permission: 'CRUD' },
      { role: 'Cashier', modul: 'Reports', permission: 'R-L' },

      { role: 'Customer', modul: 'Customers', permission: 'RU-O' },
      { role: 'Customer', modul: 'Services', permission: 'R' },
      { role: 'Customer', modul: 'Staff', permission: '-' },
      { role: 'Customer', modul: 'Appointment', permission: 'CRU-O' },
      { role: 'Customer', modul: 'Queue', permission: 'R-O' },
      { role: 'Customer', modul: 'Transaction', permission: 'R-O' },
      { role: 'Customer', modul: 'Payment', permission: 'CR-O' },
      { role: 'Customer', modul: 'Reports', permission: '-' }
    ],
    workflow: [
      'Booking → Confirmation → Check-in → Queue → Staff Assignment → Service → Payment → Completed'
    ],
    variant: [
      {
        nama: 'Barbershop',
        deskripsi: 'Layanan pangkas rambut pria dengan pemilihan kursi dan kapster.',
        tambahan: ['Barber', 'Chair', 'Barber Schedule', 'Commission']
      },
      {
        nama: 'Salon',
        deskripsi: 'Layanan perawatan kecantikan dan tata rambut wanita.',
        tambahan: ['Stylist', 'Treatment', 'Treatment Package', 'Product Usage']
      },
      {
        nama: 'Spa',
        deskripsi: 'Layanan pijat relaksasi dan spa tubuh.',
        tambahan: ['Therapist', 'Room', 'Treatment', 'Therapist Schedule']
      }
    ]
  },

  // ===========================================================================
  // MT-05 — Workshop & Service Order
  // ===========================================================================
  {
    id: 'MT-05',
    nama: 'Workshop & Service Order',
    deskripsi: 'Blueprint bengkel kendaraan, reparasi aset, work order mekanik, estimasi biaya, dan inventori sparepart.',
    modulDanSection: [
      { modul: 'Customers', sections: ['Customer', 'Contact', 'History'] },
      { modul: 'Vehicles', sections: ['Vehicle / Asset', 'Registration', 'Mileage', 'Ownership', 'Service History'] },
      { modul: 'Inspection', sections: ['Inspection Form', 'Checklist', 'Findings', 'Photos', 'Estimate'] },
      { modul: 'Service Order', sections: ['Service Request', 'Work Order', 'Job Assignment', 'Status', 'History'] },
      { modul: 'Technician', sections: ['Technician', 'Skill', 'Schedule', 'Workload'] },
      { modul: 'Spareparts', sections: ['Parts', 'Price', 'Stock', 'Usage'] },
      { modul: 'Inventory', sections: ['Stock', 'Movement', 'Opname', 'Transfer'] },
      { modul: 'Payment', sections: ['Invoice', 'Payment', 'Refund'] },
      { modul: 'Reports', sections: ['Service', 'Technician', 'Parts', 'Revenue', 'Customer'] }
    ],
    roleDefault: ['Owner', 'Workshop Manager', 'Service Advisor', 'Technician', 'Sparepart Staff', 'Warehouse', 'Cashier', 'Customer'],
    adminRoleGuidance: 'Untuk bengkel standar, gabung Owner dan Workshop Manager menjadi 1 role "Admin/Kepala Bengkel". Pisahkan HANYA jika user meminta pengawasan investor/owner terpisah.',
    roleToModule: [
      { role: 'Owner', modul: 'Customers', permission: 'CRUD' },
      { role: 'Owner', modul: 'Vehicles', permission: 'CRUD' },
      { role: 'Owner', modul: 'Inspection', permission: 'CRUD' },
      { role: 'Owner', modul: 'Service Order', permission: 'CRUD' },
      { role: 'Owner', modul: 'Technician', permission: 'CRUD' },
      { role: 'Owner', modul: 'Spareparts', permission: 'CRUD' },
      { role: 'Owner', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Owner', modul: 'Payment', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },

      { role: 'Workshop Manager', modul: 'Customers', permission: 'CRUD' },
      { role: 'Workshop Manager', modul: 'Vehicles', permission: 'CRUD' },
      { role: 'Workshop Manager', modul: 'Inspection', permission: 'CRUD' },
      { role: 'Workshop Manager', modul: 'Service Order', permission: 'CRUD' },
      { role: 'Workshop Manager', modul: 'Technician', permission: 'CRUD' },
      { role: 'Workshop Manager', modul: 'Spareparts', permission: 'CRUD' },
      { role: 'Workshop Manager', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Workshop Manager', modul: 'Payment', permission: 'CRUD' },
      { role: 'Workshop Manager', modul: 'Reports', permission: 'R' },

      { role: 'Service Advisor', modul: 'Customers', permission: 'CRUD' },
      { role: 'Service Advisor', modul: 'Vehicles', permission: 'CRUD' },
      { role: 'Service Advisor', modul: 'Inspection', permission: 'CRUD' },
      { role: 'Service Advisor', modul: 'Service Order', permission: 'CRUD' },
      { role: 'Service Advisor', modul: 'Technician', permission: 'R' },
      { role: 'Service Advisor', modul: 'Spareparts', permission: 'R' },
      { role: 'Service Advisor', modul: 'Inventory', permission: 'R' },
      { role: 'Service Advisor', modul: 'Payment', permission: 'CR' },
      { role: 'Service Advisor', modul: 'Reports', permission: 'R-L' },

      { role: 'Technician', modul: 'Customers', permission: 'R' },
      { role: 'Technician', modul: 'Vehicles', permission: 'R' },
      { role: 'Technician', modul: 'Inspection', permission: 'CRU-S' },
      { role: 'Technician', modul: 'Service Order', permission: 'RU-S' },
      { role: 'Technician', modul: 'Technician', permission: 'RU-O' },
      { role: 'Technician', modul: 'Spareparts', permission: 'CRU-S' },
      { role: 'Technician', modul: 'Payment', permission: 'R' },
      { role: 'Technician', modul: 'Reports', permission: 'R-O' },

      { role: 'Sparepart Staff', modul: 'Spareparts', permission: 'CRUD' },
      { role: 'Sparepart Staff', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Warehouse', modul: 'Inventory', permission: 'CRUD' },
      { role: 'Cashier', modul: 'Payment', permission: 'CRUD' },
      { role: 'Customer', modul: 'Customers', permission: 'RU-O' },
      { role: 'Customer', modul: 'Vehicles', permission: 'CRU-O' },
      { role: 'Customer', modul: 'Inspection', permission: 'R-O' },
      { role: 'Customer', modul: 'Service Order', permission: 'R-O' },
      { role: 'Customer', modul: 'Payment', permission: 'CR-O' }
    ],
    workflow: [
      'Check-in → Inspection → Estimate → Customer Approval → Work Order → Technician → QC → Payment → Vehicle / Asset Release'
    ]
  },

  // ===========================================================================
  // MT-06 — Healthcare
  // ===========================================================================
  {
    id: 'MT-06',
    nama: 'Healthcare',
    deskripsi: 'Blueprint klinik kesehatan, rekam medis pasien, antrean poli, resep obat farmasi, dan billing.',
    modulDanSection: [
      { modul: 'Patients', sections: ['Patient Profile', 'Identity', 'Contact', 'History'] },
      { modul: 'Registration', sections: ['Registration', 'Queue', 'Visit'] },
      { modul: 'Appointment', sections: ['Booking', 'Calendar', 'Confirmation', 'Check-in'] },
      { modul: 'Medical Record', sections: ['Examination', 'Diagnosis', 'Treatment', 'Prescription', 'Medical History'] },
      { modul: 'Services', sections: ['Service Catalog', 'Price', 'Doctor / Provider'] },
      { modul: 'Billing', sections: ['Invoice', 'Charges', 'Insurance', 'Payment'] },
      { modul: 'Pharmacy', sections: ['Medicines', 'Stock', 'Dispensing', 'Expiry'] },
      { modul: 'Reports', sections: ['Visit', 'Revenue', 'Inventory', 'Service'] }
    ],
    roleDefault: ['Owner', 'Manager', 'Admin', 'Receptionist', 'Doctor', 'Nurse', 'Pharmacist', 'Cashier', 'Medical Record', 'Patient'],
    adminRoleGuidance: 'Untuk klinik/praktik mandiri standar, konsolidasikan Owner, Manager, dan Admin menjadi 1 role "Admin" (atau "Admin Klinik") saja untuk mengelola akun dokter/staf, master tarif, dan parameter layanan. Pisahkan jadi Owner + Manager HANYA jika pengguna eksplisit meminta manajemen rumah sakit bertingkat atau multi-klinik.',
    roleToModule: [
      { role: 'Owner', modul: 'Patients', permission: 'CRUD' },
      { role: 'Owner', modul: 'Registration', permission: 'CRUD' },
      { role: 'Owner', modul: 'Appointment', permission: 'CRUD' },
      { role: 'Owner', modul: 'Medical Record', permission: 'CRUD' },
      { role: 'Owner', modul: 'Services', permission: 'CRUD' },
      { role: 'Owner', modul: 'Billing', permission: 'CRUD' },
      { role: 'Owner', modul: 'Pharmacy', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },

      { role: 'Manager', modul: 'Patients', permission: 'CRUD' },
      { role: 'Manager', modul: 'Registration', permission: 'CRUD' },
      { role: 'Manager', modul: 'Appointment', permission: 'CRUD' },
      { role: 'Manager', modul: 'Medical Record', permission: 'R' },
      { role: 'Manager', modul: 'Services', permission: 'CRUD' },
      { role: 'Manager', modul: 'Billing', permission: 'CRUD' },
      { role: 'Manager', modul: 'Pharmacy', permission: 'CRUD' },
      { role: 'Manager', modul: 'Reports', permission: 'R' },

      { role: 'Admin', modul: 'Patients', permission: 'CRUD' },
      { role: 'Admin', modul: 'Registration', permission: 'CRUD' },
      { role: 'Admin', modul: 'Appointment', permission: 'CRUD' },
      { role: 'Admin', modul: 'Medical Record', permission: 'R' },
      { role: 'Admin', modul: 'Services', permission: 'CRUD' },
      { role: 'Admin', modul: 'Billing', permission: 'CRUD' },
      { role: 'Admin', modul: 'Pharmacy', permission: 'R' },
      { role: 'Admin', modul: 'Reports', permission: 'R' },

      { role: 'Receptionist', modul: 'Patients', permission: 'CRUD' },
      { role: 'Receptionist', modul: 'Registration', permission: 'CRUD' },
      { role: 'Receptionist', modul: 'Appointment', permission: 'CRUD' },
      { role: 'Receptionist', modul: 'Medical Record', permission: 'R' },
      { role: 'Receptionist', modul: 'Services', permission: 'R' },
      { role: 'Receptionist', modul: 'Billing', permission: 'R' },
      { role: 'Receptionist', modul: 'Pharmacy', permission: 'R' },
      { role: 'Receptionist', modul: 'Reports', permission: 'R-L' },

      { role: 'Doctor', modul: 'Patients', permission: 'R/U' },
      { role: 'Doctor', modul: 'Registration', permission: 'R' },
      { role: 'Doctor', modul: 'Appointment', permission: 'R/U' },
      { role: 'Doctor', modul: 'Medical Record', permission: 'CRUD' },
      { role: 'Doctor', modul: 'Services', permission: 'R' },
      { role: 'Doctor', modul: 'Billing', permission: 'R' },
      { role: 'Doctor', modul: 'Pharmacy', permission: 'R' },
      { role: 'Doctor', modul: 'Reports', permission: 'R-O' },

      { role: 'Nurse', modul: 'Patients', permission: 'R/U' },
      { role: 'Nurse', modul: 'Registration', permission: 'R' },
      { role: 'Nurse', modul: 'Appointment', permission: 'R' },
      { role: 'Nurse', modul: 'Medical Record', permission: 'CRU' },
      { role: 'Nurse', modul: 'Services', permission: 'R' },
      { role: 'Nurse', modul: 'Billing', permission: 'R' },
      { role: 'Nurse', modul: 'Pharmacy', permission: 'R' },
      { role: 'Nurse', modul: 'Reports', permission: 'R-O' },

      { role: 'Pharmacist', modul: 'Pharmacy', permission: 'CRUD' },
      { role: 'Pharmacist', modul: 'Medical Record', permission: 'R' },
      { role: 'Pharmacist', modul: 'Reports', permission: 'R-L' },

      { role: 'Cashier', modul: 'Billing', permission: 'CRUD' },
      { role: 'Cashier', modul: 'Patients', permission: 'CR' },
      { role: 'Cashier', modul: 'Reports', permission: 'R-L' },

      { role: 'Medical Record', modul: 'Medical Record', permission: 'CRUD' },
      { role: 'Medical Record', modul: 'Patients', permission: 'CRUD' },
      { role: 'Medical Record', modul: 'Reports', permission: 'R-L' },

      { role: 'Patient', modul: 'Patients', permission: 'RU-O' },
      { role: 'Patient', modul: 'Registration', permission: 'CR-O' },
      { role: 'Patient', modul: 'Appointment', permission: 'CRU-O' },
      { role: 'Patient', modul: 'Medical Record', permission: 'R-O' },
      { role: 'Patient', modul: 'Billing', permission: 'R-O' },
      { role: 'Patient', modul: 'Pharmacy', permission: 'R-O' },
      { role: 'Patient', modul: 'Reports', permission: 'R-O' }
    ],
    workflow: [
      'Registration → Queue → Examination → Diagnosis / Treatment → Prescription → Billing → Payment → Completed'
    ]
  },

  // ===========================================================================
  // MT-07 — Manufacturing
  // ===========================================================================
  {
    id: 'MT-07',
    nama: 'Manufacturing',
    deskripsi: 'Blueprint manufaktur, Bill of Materials (BOM), rencana produksi, work order, mesin, dan quality control (QC).',
    modulDanSection: [
      { modul: 'Products', sections: ['Finished Goods', 'Semi Finished', 'SKU', 'Specification'] },
      { modul: 'BOM', sections: ['Bill of Materials', 'Components', 'Quantity', 'Version'] },
      { modul: 'Materials', sections: ['Raw Material', 'Stock', 'Lot / Batch', 'Expiry'] },
      { modul: 'Purchasing', sections: ['Purchase Request', 'Purchase Order', 'Receiving'] },
      { modul: 'Production Planning', sections: ['Demand', 'Production Plan', 'Capacity'] },
      { modul: 'Production Order', sections: ['Work Order', 'Material Issue', 'Production Result', 'Scrap'] },
      { modul: 'Machine', sections: ['Machine', 'Availability', 'Utilization'] },
      { modul: 'Maintenance', sections: ['Schedule', 'Work Order', 'History'] },
      { modul: 'Quality', sections: ['QC Inspection', 'Defect', 'Approval', 'Release'] },
      { modul: 'Warehouse', sections: ['Raw Material', 'WIP', 'Finished Goods', 'Transfer'] },
      { modul: 'Reports', sections: ['Production', 'Quality', 'Inventory', 'Machine', 'Cost'] }
    ],
    roleDefault: ['Director', 'Plant Manager', 'Production Manager', 'Planner', 'Supervisor', 'Operator', 'QC/QA', 'Warehouse', 'Purchasing', 'Maintenance', 'Finance'],
    adminRoleGuidance: 'Untuk skala UKM manufaktur, gabung Director, Plant Manager, dan Supervisor menjadi 1 role "Admin Produksi/Manajer". Pisahkan HANYA untuk pabrik skala korporasi multi-divisi.',
    roleToModule: [
      { role: 'Director', modul: 'Products', permission: 'CRUD' },
      { role: 'Director', modul: 'BOM', permission: 'CRUD' },
      { role: 'Director', modul: 'Materials', permission: 'CRUD' },
      { role: 'Director', modul: 'Production Plan', permission: 'CRUD' },
      { role: 'Director', modul: 'Production Order', permission: 'CRUD' },
      { role: 'Director', modul: 'Quality', permission: 'CRUD' },
      { role: 'Director', modul: 'Reports', permission: 'R' },

      { role: 'Plant Manager', modul: 'Products', permission: 'CRUD' },
      { role: 'Plant Manager', modul: 'BOM', permission: 'CRUD' },
      { role: 'Plant Manager', modul: 'Production Plan', permission: 'CRUD' },
      { role: 'Plant Manager', modul: 'Production Order', permission: 'CRUD' },
      { role: 'Plant Manager', modul: 'Quality', permission: 'CRUD' },
      { role: 'Plant Manager', modul: 'Reports', permission: 'R' },

      { role: 'Production Manager', modul: 'Production Plan', permission: 'CRUD' },
      { role: 'Production Manager', modul: 'Production Order', permission: 'CRUD' },
      { role: 'Planner', modul: 'BOM', permission: 'CRUD' },
      { role: 'Planner', modul: 'Production Plan', permission: 'CRUD' },
      { role: 'Planner', modul: 'Production Order', permission: 'CRUD' },
      { role: 'Supervisor', modul: 'Production Order', permission: 'CRUD' },
      { role: 'Operator', modul: 'Production Order', permission: 'RU-S' },
      { role: 'QC/QA', modul: 'Quality', permission: 'CRUD' },
      { role: 'Warehouse', modul: 'Warehouse', permission: 'CRUD' },
      { role: 'Purchasing', modul: 'Purchasing', permission: 'CRUD' },
      { role: 'Maintenance', modul: 'Machine', permission: 'CRUD' },
      { role: 'Maintenance', modul: 'Maintenance', permission: 'CRUD' },
      { role: 'Finance', modul: 'Reports', permission: 'R' }
    ],
    workflow: [
      'Demand → Production Plan → Material Check → Material Issue → Production → QC → Finished Goods → Warehouse → Shipment'
    ]
  },

  // ===========================================================================
  // MT-08 — Project & Professional Service
  // ===========================================================================
  {
    id: 'MT-08',
    nama: 'Project & Professional Service',
    deskripsi: 'Blueprint konsultan, agency, software house, manajemen project, milestone, timesheet, dan billing klien.',
    modulDanSection: [
      { modul: 'Clients', sections: ['Client List', 'Profile', 'Contacts', 'History'] },
      { modul: 'Projects', sections: ['Project List', 'Overview', 'Scope', 'Budget', 'Status'] },
      { modul: 'Tasks', sections: ['Task Board', 'Task List', 'Assignment', 'Priority', 'Comments'] },
      { modul: 'Team', sections: ['Team Members', 'Roles', 'Allocation', 'Capacity'] },
      { modul: 'Milestones', sections: ['Milestone List', 'Deadlines', 'Deliverables', 'Status'] },
      { modul: 'Timesheet', sections: ['Log Time', 'Weekly Timesheet', 'Approval', 'History'] },
      { modul: 'Documents', sections: ['Files', 'Deliverables', 'Contracts', 'Versions'] },
      { modul: 'Quotes', sections: ['Proposal', 'Estimate', 'Terms', 'Approval'] },
      { modul: 'Invoices', sections: ['Invoice List', 'Term of Payment', 'Tax', 'Status'] },
      { modul: 'Expenses', sections: ['Project Expenses', 'Reimbursement', 'Receipts'] },
      { modul: 'Payments', sections: ['Payment Records', 'Method', 'Receipt'] },
      { modul: 'Reports', sections: ['Project Profitability', 'Time Log', 'Team Utilization', 'Revenue'] }
    ],
    roleDefault: ['Owner', 'Director', 'Project Manager', 'Account Manager', 'Consultant', 'Staff', 'Finance', 'Admin', 'Client'],
    adminRoleGuidance: 'Untuk biro jasa/konsultan standar, gabung Owner, Director, dan Project Manager menjadi 1 role "Admin/Lead Project". Pisahkan HANYA jika ada hierarki direksi terpisah.',
    roleToModule: [
      { role: 'Owner', modul: 'Clients', permission: 'CRUD' },
      { role: 'Owner', modul: 'Projects', permission: 'CRUD' },
      { role: 'Owner', modul: 'Tasks', permission: 'CRUD' },
      { role: 'Owner', modul: 'Invoices', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },

      { role: 'Project Manager', modul: 'Projects', permission: 'CRUD' },
      { role: 'Project Manager', modul: 'Tasks', permission: 'CRUD' },
      { role: 'Project Manager', modul: 'Milestones', permission: 'CRUD' },
      { role: 'Project Manager', modul: 'Timesheet', permission: 'CRUD' },
      { role: 'Project Manager', modul: 'Documents', permission: 'CRUD' },

      { role: 'Consultant', modul: 'Tasks', permission: 'RU-S' },
      { role: 'Consultant', modul: 'Timesheet', permission: 'CRU-O' },
      { role: 'Staff', modul: 'Tasks', permission: 'RU-S' },
      { role: 'Staff', modul: 'Timesheet', permission: 'CRU-O' },
      { role: 'Finance', modul: 'Invoices', permission: 'CRUD' },
      { role: 'Finance', modul: 'Payments', permission: 'CRUD' },
      { role: 'Client', modul: 'Projects', permission: 'R-O' },
      { role: 'Client', modul: 'Invoices', permission: 'R-O' },
      { role: 'Client', modul: 'Payments', permission: 'CR-O' }
    ],
    workflow: [
      'Lead → Quote → Approval → Project → Milestones → Tasks → Delivery → Invoice → Payment'
    ]
  },

  // ===========================================================================
  // MT-09 — Booking & Hospitality
  // ===========================================================================
  {
    id: 'MT-09',
    nama: 'Booking & Hospitality',
    deskripsi: 'Blueprint hotel, guest house, villa, reservasi kamar, kalender ketersediaan, check-in, dan check-out.',
    modulDanSection: [
      { modul: 'Customers', sections: ['Guest List', 'Guest Profile', 'History', 'Preferences'] },
      { modul: 'Resources', sections: ['Rooms', 'Beds', 'Amenities', 'Room Status', 'Maintenance'] },
      { modul: 'Availability', sections: ['Calendar Grid', 'Rates', 'Seasons', 'Block Dates'] },
      { modul: 'Booking', sections: ['Reservation List', 'Direct Booking', 'OTA Sync', 'Voucher'] },
      { modul: 'Calendar', sections: ['Daily View', 'Monthly View', 'Timeline'] },
      { modul: 'Check-in/out', sections: ['Check-in Form', 'Key Card', 'Deposit', 'Check-out Form', 'Folio'] },
      { modul: 'Payments', sections: ['Payment Method', 'Down Payment', 'Settlement', 'Refund'] },
      { modul: 'Invoices', sections: ['Folio Bill', 'Extra Charges', 'Invoice Print'] },
      { modul: 'Reviews', sections: ['Guest Feedback', 'Rating', 'Response'] },
      { modul: 'Reports', sections: ['Occupancy Rate', 'RevPAR', 'Revenue', 'Guest Nationality'] }
    ],
    roleDefault: ['Owner', 'Manager', 'Admin', 'Reservation', 'Front Office', 'Operations', 'Finance', 'Customer'],
    adminRoleGuidance: 'Untuk homestay/hotel/penginapan standar, gabung Owner, Manager, dan Admin menjadi 1 role "Admin/Manajer Penginapan". Pisahkan HANYA untuk hotel bintang/multi-properti.',
    roleToModule: [
      { role: 'Owner', modul: 'Booking', permission: 'CRUD' },
      { role: 'Owner', modul: 'Resources', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },
      { role: 'Manager', modul: 'Booking', permission: 'CRUD' },
      { role: 'Manager', modul: 'Resources', permission: 'CRUD' },
      { role: 'Reservation', modul: 'Booking', permission: 'CRUD' },
      { role: 'Reservation', modul: 'Availability', permission: 'CRUD' },
      { role: 'Front Office', modul: 'Check-in/out', permission: 'CRUD' },
      { role: 'Front Office', modul: 'Booking', permission: 'CRU' },
      { role: 'Operations', modul: 'Resources', permission: 'RU' },
      { role: 'Finance', modul: 'Payments', permission: 'CRUD' },
      { role: 'Customer', modul: 'Booking', permission: 'CRU-O' },
      { role: 'Customer', modul: 'Payments', permission: 'CR-O' }
    ],
    workflow: [
      'Availability → Booking → Confirmation → Payment → Check-in → Service → Check-out → Review'
    ]
  },

  // ===========================================================================
  // MT-10 — Education
  // ===========================================================================
  {
    id: 'MT-10',
    nama: 'Education',
    deskripsi: 'Blueprint sekolah, bimbel, kursus, data siswa/guru, presensi, tugas/ujian, nilai, dan SPP.',
    modulDanSection: [
      { modul: 'Students', sections: ['Student List', 'NISN', 'Class Assignment', 'Academic Record', 'Guardian'] },
      { modul: 'Teachers', sections: ['Teacher List', 'Subject Specialty', 'Schedule', 'Profile'] },
      { modul: 'Classes', sections: ['Classroom', 'Academic Year', 'Semester', 'Wali Kelas'] },
      { modul: 'Subjects', sections: ['Curriculum', 'Syllabus', 'Competency'] },
      { modul: 'Schedules', sections: ['Time Slot', 'Weekly Roster', 'Room Allocation'] },
      { modul: 'Attendance', sections: ['Daily Roll Call', 'Subject Attendance', 'Leave / Sick Request'] },
      { modul: 'Assignments', sections: ['Homework', 'Quiz', 'Submission', 'Grading'] },
      { modul: 'Grades', sections: ['Score Sheet', 'Rapor', 'Extracurricular Score', 'Rank'] },
      { modul: 'Payments', sections: ['Tuition Fee (SPP)', 'Registration Fee', 'Invoice', 'Payment Receipt'] },
      { modul: 'Reports', sections: ['Academic Performance', 'Attendance Summary', 'Finance Collection'] }
    ],
    roleDefault: ['Owner/Foundation', 'Principal/Director', 'Admin', 'Teacher', 'Homeroom Teacher', 'Finance', 'Student', 'Parent'],
    adminRoleGuidance: 'Untuk bimbel/kursus/sekolah standar, gabung Owner/Yayasan dan Principal/Kepala Sekolah menjadi 1 role "Admin/Pengelola". Pisahkan HANYA jika yayasan meminta portal pengawas terpisah.',
    roleToModule: [
      { role: 'Principal/Director', modul: 'Students', permission: 'CRUD' },
      { role: 'Principal/Director', modul: 'Teachers', permission: 'CRUD' },
      { role: 'Principal/Director', modul: 'Reports', permission: 'R' },
      { role: 'Admin', modul: 'Students', permission: 'CRUD' },
      { role: 'Admin', modul: 'Classes', permission: 'CRUD' },
      { role: 'Teacher', modul: 'Attendance', permission: 'CRUD' },
      { role: 'Teacher', modul: 'Assignments', permission: 'CRUD' },
      { role: 'Teacher', modul: 'Grades', permission: 'CRUD' },
      { role: 'Homeroom Teacher', modul: 'Grades', permission: 'CRUD' },
      { role: 'Finance', modul: 'Payments', permission: 'CRUD' },
      { role: 'Student', modul: 'Assignments', permission: 'CRU-O' },
      { role: 'Student', modul: 'Grades', permission: 'R-O' },
      { role: 'Parent', modul: 'Attendance', permission: 'R-O' },
      { role: 'Parent', modul: 'Payments', permission: 'CRU-O' }
    ],
    workflow: [
      'Registration → Enrollment → Class → Schedule → Attendance → Learning → Assessment → Report'
    ]
  },

  // ===========================================================================
  // MT-11 — CRM & Sales
  // ===========================================================================
  {
    id: 'MT-11',
    nama: 'CRM & Sales',
    deskripsi: 'Blueprint customer relationship management, leads, pipeline deals, follow-up, quote proposal, dan sales team.',
    modulDanSection: [
      { modul: 'Leads', sections: ['Lead List', 'Lead Source', 'Qualification', 'Conversion'] },
      { modul: 'Contacts', sections: ['Contact Profile', 'Job Title', 'Communication History'] },
      { modul: 'Companies', sections: ['Company Account', 'Industry', 'Size', 'Address'] },
      { modul: 'Opportunities', sections: ['Deal Stage', 'Value', 'Close Date', 'Probability'] },
      { modul: 'Pipeline', sections: ['Kanban Board', 'Funnel View', 'Forecast'] },
      { modul: 'Deals', sections: ['Won / Lost Analysis', 'Contract Value', 'Terms'] },
      { modul: 'Activities', sections: ['Call Log', 'Meeting Schedule', 'Email', 'Notes'] },
      { modul: 'Quotes', sections: ['Quotation Generator', 'Pricing Table', 'Discount', 'Approval'] },
      { modul: 'Sales Orders', sections: ['SO Confirmation', 'Customer PO', 'Delivery Term'] },
      { modul: 'Reports', sections: ['Sales Pipeline', 'Conversion Rate', 'Sales Rep Performance', 'Revenue Target'] }
    ],
    roleDefault: ['Sales Director', 'Sales Manager', 'Supervisor', 'Sales Executive', 'Account Executive', 'Account Manager', 'Business Development', 'Sales Admin', 'Customer'],
    adminRoleGuidance: 'Untuk tim sales standar, gabung Sales Director dan Sales Manager menjadi 1 role "Admin / Sales Lead". Pisahkan HANYA jika hierarki sales memiliki 3+ level bertingkat.',
    roleToModule: [
      { role: 'Sales Director', modul: 'Leads', permission: 'CRUD' },
      { role: 'Sales Director', modul: 'Pipeline', permission: 'CRUD' },
      { role: 'Sales Director', modul: 'Reports', permission: 'R' },
      { role: 'Sales Manager', modul: 'Leads', permission: 'CRUD' },
      { role: 'Sales Manager', modul: 'Pipeline', permission: 'CRUD' },
      { role: 'Sales Executive', modul: 'Leads', permission: 'CRUD-O' },
      { role: 'Sales Executive', modul: 'Pipeline', permission: 'RU-S' },
      { role: 'Sales Executive', modul: 'Quotes', permission: 'CRU-O' },
      { role: 'Sales Admin', modul: 'Quotes', permission: 'CRU' },
      { role: 'Sales Admin', modul: 'Sales Orders', permission: 'CRU' },
      { role: 'Customer', modul: 'Quotes', permission: 'R-O' }
    ],
    workflow: [
      'Lead → Qualification → Opportunity → Follow-up → Proposal → Negotiation → Deal → Customer'
    ]
  },

  // ===========================================================================
  // MT-12 — Finance & Accounting
  // ===========================================================================
  {
    id: 'MT-12',
    nama: 'Finance & Accounting',
    deskripsi: 'Blueprint buku besar, kas & bank, jurnal umum, piutang/utang (AR/AP), rekonsiliasi, dan laporan laba rugi.',
    modulDanSection: [
      { modul: 'Accounts', sections: ['Chart of Accounts (COA)', 'Account Category', 'Opening Balance'] },
      { modul: 'Cash', sections: ['Petty Cash', 'Cash In / Out', 'Voucher'] },
      { modul: 'Bank', sections: ['Bank Accounts', 'Bank Statement', 'Reconciliation'] },
      { modul: 'Income', sections: ['Revenue Entry', 'Category', 'Customer Receipt'] },
      { modul: 'Expense', sections: ['Operational Expense', 'Vendor Bill', 'Approval'] },
      { modul: 'Journal', sections: ['General Journal', 'Adjustment Journal', 'Reversal'] },
      { modul: 'Ledger', sections: ['General Ledger Book', 'Trial Balance'] },
      { modul: 'Receivables', sections: ['Aging AR', 'Customer Statement', 'Collection'] },
      { modul: 'Payables', sections: ['Aging AP', 'Vendor Statement', 'Payment Schedule'] },
      { modul: 'Invoice', sections: ['Commercial Invoice', 'Tax Invoice (Faktur)', 'Recurring'] },
      { modul: 'Payment', sections: ['Disbursement', 'Receipt Voucher', 'Withholding'] },
      { modul: 'Tax', sections: ['PPN / PPh Calculation', 'Tax Report', 'Tax Filing'] },
      { modul: 'Reports', sections: ['Balance Sheet', 'Profit & Loss', 'Cash Flow', 'General Ledger'] }
    ],
    roleDefault: ['Owner', 'Finance Manager', 'Finance Officer', 'Accountant', 'Bookkeeper', 'AR/AP', 'Tax', 'Auditor', 'Approver', 'Viewer'],
    adminRoleGuidance: 'Untuk keuangan bisnis standar, gabung Owner dan Finance Manager menjadi 1 role "Admin Keuangan". Pisahkan HANYA jika ada pemisahan Maker-Checker/Auditor eksternal.',
    roleToModule: [
      { role: 'Owner', modul: 'Accounts', permission: 'CRUD' },
      { role: 'Owner', modul: 'Journal', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },
      { role: 'Finance Manager', modul: 'Accounts', permission: 'CRUD' },
      { role: 'Finance Manager', modul: 'Journal', permission: 'CRUD' },
      { role: 'Finance Manager', modul: 'Reports', permission: 'R' },
      { role: 'Accountant', modul: 'Accounts', permission: 'CRUD' },
      { role: 'Accountant', modul: 'Journal', permission: 'CRUD' },
      { role: 'Accountant', modul: 'Ledger', permission: 'CRUD' },
      { role: 'Bookkeeper', modul: 'Cash', permission: 'CRU' },
      { role: 'Bookkeeper', modul: 'Journal', permission: 'CRU' },
      { role: 'AR/AP', modul: 'Receivables', permission: 'CRUD' },
      { role: 'AR/AP', modul: 'Payables', permission: 'CRUD' },
      { role: 'Tax', modul: 'Tax', permission: 'CRUD' },
      { role: 'Auditor', modul: 'Ledger', permission: 'V' },
      { role: 'Approver', modul: 'Journal', permission: 'A' },
      { role: 'Viewer', modul: 'Reports', permission: 'R' }
    ],
    workflow: [
      'Transaction → Journal → Review → Approval → Posting → Reconciliation → Financial Report'
    ]
  },

  // ===========================================================================
  // MT-13 — Property Management
  // ===========================================================================
  {
    id: 'MT-13',
    nama: 'Property Management',
    deskripsi: 'Blueprint sewa properti, gedung, unit kos/apartemen, kontrak penyewa, tagihan utilitas, dan perbaikan/maintenance.',
    modulDanSection: [
      { modul: 'Properties', sections: ['Property List', 'Building', 'Facilities', 'Location'] },
      { modul: 'Units', sections: ['Unit Number', 'Floor', 'Type', 'Furnishing', 'Rental Rate', 'Status'] },
      { modul: 'Tenants', sections: ['Tenant Directory', 'ID Card / KTP', 'Emergency Contact', 'Family Members'] },
      { modul: 'Contracts', sections: ['Lease Agreement', 'Duration', 'Deposit', 'Renewal', 'Termination'] },
      { modul: 'Rent', sections: ['Monthly Billing', 'Late Penalty', 'Payment Tracking'] },
      { modul: 'Invoices', sections: ['Rental Invoice', 'Service Charge', 'Receipt'] },
      { modul: 'Payments', sections: ['Payment Method', 'Virtual Account', 'Proof of Transfer'] },
      { modul: 'Utilities', sections: ['Electricity Meter', 'Water Meter', 'Internet', 'Bill Calculation'] },
      { modul: 'Maintenance', sections: ['Issue Ticket', 'Technician Dispatch', 'Cost', 'Resolution'] },
      { modul: 'Reports', sections: ['Occupancy Trend', 'Revenue Collection', 'Outstanding Rent', 'Maintenance Cost'] }
    ],
    roleDefault: ['Owner', 'Property Manager', 'Admin', 'Leasing', 'Finance', 'Maintenance', 'Tenant'],
    adminRoleGuidance: 'Untuk kost/sewa properti standar, gabung Owner dan Property Manager menjadi 1 role "Admin Properti / Pemilik". Pisahkan HANYA jika ada pengelola lapangan terpisah dari pemilik.',
    roleToModule: [
      { role: 'Owner', modul: 'Properties', permission: 'CRUD' },
      { role: 'Owner', modul: 'Units', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },
      { role: 'Property Manager', modul: 'Properties', permission: 'CRUD' },
      { role: 'Property Manager', modul: 'Contracts', permission: 'CRUD' },
      { role: 'Leasing', modul: 'Contracts', permission: 'CRUD' },
      { role: 'Finance', modul: 'Rent', permission: 'CRUD' },
      { role: 'Finance', modul: 'Invoices', permission: 'CRUD' },
      { role: 'Maintenance', modul: 'Maintenance', permission: 'CRUD' },
      { role: 'Tenant', modul: 'Contracts', permission: 'R-O' },
      { role: 'Tenant', modul: 'Invoices', permission: 'R-O' },
      { role: 'Tenant', modul: 'Maintenance', permission: 'CR-O' }
    ],
    workflow: [
      'Property → Unit → Tenant → Contract → Billing → Payment → Maintenance'
    ]
  },

  // ===========================================================================
  // MT-14 — Logistics & Delivery
  // ===========================================================================
  {
    id: 'MT-14',
    nama: 'Logistics & Delivery',
    deskripsi: 'Blueprint ekspedisi, kurir, armada pengiriman, paket/resi, rute pengiriman, dan tracking live.',
    modulDanSection: [
      { modul: 'Customers', sections: ['Sender Profile', 'Receiver Directory', 'Address Book'] },
      { modul: 'Orders', sections: ['Pickup Request', 'Order List', 'Service Type', 'Special Handling'] },
      { modul: 'Shipments', sections: ['Airway Bill (Resi)', 'Barcode', 'Weight / Volume', 'Manifest'] },
      { modul: 'Warehouse', sections: ['Inbound Sorting', 'Outbound Hub', 'Bin Storage', 'Transfer Hub'] },
      { modul: 'Drivers', sections: ['Driver Profile', 'SIM', 'Assigned Vehicle', 'Status'] },
      { modul: 'Vehicles', sections: ['Fleet List', 'Capacity', 'Fuel Log', 'Service Record'] },
      { modul: 'Routes', sections: ['Delivery Area', 'Route Optimization', 'Waypoints'] },
      { modul: 'Tracking', sections: ['Live Status', 'Checkpoint History', 'ETA'] },
      { modul: 'Delivery', sections: ['Proof of Delivery (POD)', 'Signature', 'Photo', 'Return to Sender'] },
      { modul: 'Payments', sections: ['COD Management', 'Freight Charge', 'Disbursement'] },
      { modul: 'Reports', sections: ['Delivery Success Rate', 'On-Time Performance', 'Fleet Cost', 'COD Reconciliation'] }
    ],
    roleDefault: ['Owner', 'Operations Manager', 'Admin', 'Customer Service', 'Dispatcher', 'Warehouse', 'Driver/Courier', 'Checker', 'Finance', 'Customer'],
    adminRoleGuidance: 'Untuk ekspedisi/kurir standar, gabung Owner dan Operations Manager menjadi 1 role "Admin Operasional / Dispatcher". Pisahkan HANYA untuk logistik multi-hub.',
    roleToModule: [
      { role: 'Owner', modul: 'Shipments', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },
      { role: 'Operations Manager', modul: 'Shipments', permission: 'CRUD' },
      { role: 'Operations Manager', modul: 'Routes', permission: 'CRUD' },
      { role: 'Dispatcher', modul: 'Drivers', permission: 'CRUD' },
      { role: 'Dispatcher', modul: 'Routes', permission: 'CRUD' },
      { role: 'Warehouse', modul: 'Warehouse', permission: 'CRUD' },
      { role: 'Driver/Courier', modul: 'Delivery', permission: 'CRUD-O' },
      { role: 'Driver/Courier', modul: 'Tracking', permission: 'RU-S' },
      { role: 'Finance', modul: 'Payments', permission: 'CRUD' },
      { role: 'Customer', modul: 'Orders', permission: 'CRU-O' },
      { role: 'Customer', modul: 'Tracking', permission: 'R-O' }
    ],
    workflow: [
      'Order → Shipment → Pickup → Sorting → Dispatch → Delivery → Proof of Delivery → Completed'
    ]
  },

  // ===========================================================================
  // MT-15 — Membership & Subscription
  // ===========================================================================
  {
    id: 'MT-15',
    nama: 'Membership & Subscription',
    deskripsi: 'Blueprint gym/fitness, klub member, langganan recurring, presensi kartu/QR, dan benefit anggota.',
    modulDanSection: [
      { modul: 'Members', sections: ['Member List', 'Member Profile', 'Card / QR Number', 'Status'] },
      { modul: 'Plans', sections: ['Subscription Plan', 'Duration', 'Price', 'Recurring Interval'] },
      { modul: 'Registration', sections: ['New Member Form', 'Terms & Agreement', 'Health Questionnaire'] },
      { modul: 'Subscription', sections: ['Active Subscriptions', 'Expiry Date', 'Freeze Membership', 'Renewal'] },
      { modul: 'Payments', sections: ['Payment Gateway', 'Auto Debit', 'Cash', 'Invoice Receipt'] },
      { modul: 'Attendance', sections: ['Check-in Scanner', 'Visit History', 'Peak Hours Log'] },
      { modul: 'Benefits', sections: ['Perks / Discounts', 'Class Pass', 'Personal Trainer Quota'] },
      { modul: 'Transactions', sections: ['Merchandise Sales', 'Locker Rental', 'Add-on Services'] },
      { modul: 'Notifications', sections: ['Expiry Reminder', 'Class Schedule Broadcast', 'Promo'] },
      { modul: 'Reports', sections: ['Member Retention', 'Churn Rate', 'MRR / Revenue', 'Attendance Frequency'] }
    ],
    roleDefault: ['Owner', 'Manager', 'Admin', 'Receptionist', 'Staff', 'Finance', 'Member'],
    adminRoleGuidance: 'Untuk gym/studio/komunitas standar, gabung Owner dan Manager menjadi 1 role "Admin Gym / Pengelola". Pisahkan HANYA jika ada manajemen cabang terpisah.',
    roleToModule: [
      { role: 'Owner', modul: 'Members', permission: 'CRUD' },
      { role: 'Owner', modul: 'Plans', permission: 'CRUD' },
      { role: 'Owner', modul: 'Reports', permission: 'R' },
      { role: 'Manager', modul: 'Members', permission: 'CRUD' },
      { role: 'Manager', modul: 'Subscription', permission: 'CRUD' },
      { role: 'Receptionist', modul: 'Members', permission: 'CRUD' },
      { role: 'Receptionist', modul: 'Attendance', permission: 'CRUD' },
      { role: 'Finance', modul: 'Payments', permission: 'CRUD' },
      { role: 'Member', modul: 'Members', permission: 'RU-O' },
      { role: 'Member', modul: 'Subscription', permission: 'CRU-O' },
      { role: 'Member', modul: 'Attendance', permission: 'CR-O' }
    ],
    workflow: [
      'Registration → Plan Selection → Payment → Active Membership → Attendance / Usage → Renewal'
    ]
  },

  // ===========================================================================
  // MT-16 — Human Resources
  // ===========================================================================
  {
    id: 'MT-16',
    nama: 'Human Resources',
    deskripsi: 'Blueprint manajemen SDM, absensi, cuti karyawan, payroll/penggajian, rekrutmen, dan penilaian performa (KPI).',
    modulDanSection: [
      { modul: 'Employees', sections: ['Employee Directory', 'Personal Details', 'Contract', 'Emergency Contact'] },
      { modul: 'Departments', sections: ['Organization Chart', 'Divisions', 'Head of Dept'] },
      { modul: 'Positions', sections: ['Job Title', 'Job Level', 'Job Description', 'Salary Grade'] },
      { modul: 'Attendance', sections: ['Clock In / Out', 'Shift Schedule', 'Overtime', 'Lateness Log'] },
      { modul: 'Leave', sections: ['Leave Balance', 'Leave Request', 'Approval Flow', 'Holiday Calendar'] },
      { modul: 'Payroll', sections: ['Salary Component', 'Tax / BPJS', 'Payslip Generator', 'Bank Disbursement'] },
      { modul: 'Recruitment', sections: ['Job Vacancy', 'Applicant Tracking (ATS)', 'Interview', 'Offering'] },
      { modul: 'Performance', sections: ['KPI / OKR Setting', 'Appraisal Form', '360 Review', 'Score'] },
      { modul: 'Documents', sections: ['Employment Letter (SK)', 'Certificates', 'Warnings (SP)'] },
      { modul: 'Reports', sections: ['Headcount', 'Turnover Rate', 'Payroll Cost', 'Attendance Rate'] }
    ],
    roleDefault: ['HR Director', 'HR Manager', 'HR Officer', 'Recruiter', 'Payroll', 'Admin', 'Manager', 'Employee'],
    adminRoleGuidance: 'Untuk HR UKM, gabung HR Director dan HR Manager menjadi 1 role "Admin HRD". Pisahkan HANYA jika ada struktur korporasi multi-divisi.',
    roleToModule: [
      { role: 'HR Director', modul: 'Employees', permission: 'CRUD' },
      { role: 'HR Director', modul: 'Payroll', permission: 'CRUD' },
      { role: 'HR Director', modul: 'Reports', permission: 'R' },
      { role: 'HR Manager', modul: 'Employees', permission: 'CRUD' },
      { role: 'HR Manager', modul: 'Leave', permission: 'CRUD' },
      { role: 'HR Manager', modul: 'Performance', permission: 'CRUD' },
      { role: 'Recruiter', modul: 'Recruitment', permission: 'CRUD' },
      { role: 'Payroll', modul: 'Payroll', permission: 'CRUD' },
      { role: 'Manager', modul: 'Leave', permission: 'A-S' },
      { role: 'Manager', modul: 'Performance', permission: 'CRUD-S' },
      { role: 'Employee', modul: 'Employees', permission: 'RU-O' },
      { role: 'Employee', modul: 'Attendance', permission: 'R-O' },
      { role: 'Employee', modul: 'Leave', permission: 'CRU-O' },
      { role: 'Employee', modul: 'Payroll', permission: 'R-O' }
    ],
    workflow: [
      'Recruitment → Selection → Hiring → Employee → Attendance → Leave → Payroll → Performance'
    ]
  },

  // ===========================================================================
  // MT-17 — Procurement & Inventory
  // ===========================================================================
  {
    id: 'MT-17',
    nama: 'Procurement & Inventory',
    deskripsi: 'Blueprint pengadaan barang, purchase requisition/PO, penerimaan gudang, mutasi stok, dan stock opname.',
    modulDanSection: [
      { modul: 'Products / Materials', sections: ['Material Master', 'SKU', 'Unit of Measure', 'Safety Stock'] },
      { modul: 'Suppliers', sections: ['Vendor Directory', 'Price List', 'Lead Time', 'Rating'] },
      { modul: 'Purchase Request', sections: ['PR Form', 'Department Need', 'Estimated Cost', 'Approval'] },
      { modul: 'Purchase Order', sections: ['PO Generator', 'Vendor Confirmation', 'Delivery Terms', 'Status'] },
      { modul: 'Receiving', sections: ['Good Receipt Note (GRN)', 'QC Inspection', 'Discrepancy Report'] },
      { modul: 'Warehouse', sections: ['Warehouse Location', 'Racks', 'Bin Capacity', 'Zoning'] },
      { modul: 'Inventory', sections: ['Stock On Hand', 'Stock Reserved', 'Valuation (FIFO/Average)'] },
      { modul: 'Transfer', sections: ['Inter-warehouse Transfer', 'In-transit Tracking', 'Receiving Hub'] },
      { modul: 'Adjustment', sections: ['Damaged Stock', 'Lost Stock', 'Approval Flow'] },
      { modul: 'Stock Opname', sections: ['Count Sheet', 'Discrepancy Reconciliation', 'Variance Report'] },
      { modul: 'Reports', sections: ['Inventory Turnover', 'PO Fulfillment Rate', 'Procurement Spending', 'Dead Stock'] }
    ],
    roleDefault: ['Procurement Manager', 'Purchasing', 'WH Manager', 'WH Staff', 'Inventory', 'Checker', 'Approver', 'Supplier'],
    adminRoleGuidance: 'Untuk pengadaan UKM, gabung Procurement Manager dan WH Manager menjadi 1 role "Admin Pengadaan & Gudang". Pisahkan HANYA untuk rantai pasok kompleks.',
    roleToModule: [
      { role: 'Procurement Manager', modul: 'Purchase Request', permission: 'CRUD' },
      { role: 'Procurement Manager', modul: 'Purchase Order', permission: 'CRUD' },
      { role: 'Procurement Manager', modul: 'Reports', permission: 'R' },
      { role: 'Purchasing', modul: 'Purchase Order', permission: 'CRUD' },
      { role: 'Purchasing', modul: 'Suppliers', permission: 'CRUD' },
      { role: 'WH Manager', modul: 'Warehouse', permission: 'CRUD' },
      { role: 'WH Manager', modul: 'Receiving', permission: 'CRUD' },
      { role: 'WH Staff', modul: 'Receiving', permission: 'CRUD' },
      { role: 'WH Staff', modul: 'Inventory', permission: 'CRU' },
      { role: 'Checker', modul: 'Receiving', permission: 'V' },
      { role: 'Approver', modul: 'Purchase Request', permission: 'A' },
      { role: 'Approver', modul: 'Purchase Order', permission: 'A' },
      { role: 'Supplier', modul: 'Purchase Order', permission: 'R-O' }
    ],
    workflow: [
      'Purchase Request → Approval → Purchase Order → Supplier → Receiving → Checking → Warehouse → Inventory'
    ]
  },

  // ===========================================================================
  // MT-18 — Asset & Maintenance
  // ===========================================================================
  {
    id: 'MT-18',
    nama: 'Asset & Maintenance',
    deskripsi: 'Blueprint aset tetap, barcode aset, jadwal preventive maintenance, work order teknisi, dan riwayat perbaikan.',
    modulDanSection: [
      { modul: 'Assets', sections: ['Asset Register', 'Asset Tag / QR Code', 'Purchase Cost', 'Depreciation'] },
      { modul: 'Categories', sections: ['Heavy Equipment', 'IT Devices', 'Vehicles', 'Building Facilities'] },
      { modul: 'Locations', sections: ['Site Location', 'Building', 'Room', 'Current Holder'] },
      { modul: 'Assignment', sections: ['Handover Form (BAST)', 'Custodianship', 'Return Asset'] },
      { modul: 'Maintenance Schedule', sections: ['Preventive Plan', 'Frequency (Monthly/Yearly)', 'Checklist'] },
      { modul: 'Work Orders', sections: ['Corrective Ticket', 'Technician Assignment', 'Status', 'Resolution'] },
      { modul: 'Spareparts', sections: ['Maintenance Parts', 'Usage Log', 'Part Replenishment'] },
      { modul: 'Vendors', sections: ['Third-party Service Contractor', 'SLA', 'Warranty Contract'] },
      { modul: 'History', sections: ['Downtime Log', 'Repair History', 'Cost Accumulated'] },
      { modul: 'Costs', sections: ['Maintenance Budget', 'Part Cost', 'Labor Cost'] },
      { modul: 'Reports', sections: ['Asset Uptime / MTBF', 'Depreciation Schedule', 'Maintenance Spend'] }
    ],
    roleDefault: ['Asset Manager', 'Maintenance Manager', 'Technician', 'Operator', 'Warehouse', 'Finance', 'Auditor'],
    adminRoleGuidance: 'Untuk inventaris aset UKM, gabung Asset Manager dan Maintenance Manager menjadi 1 role "Admin Aset". Pisahkan HANYA jika tim maintenance terpisah dari pengelola aset.',
    roleToModule: [
      { role: 'Asset Manager', modul: 'Assets', permission: 'CRUD' },
      { role: 'Asset Manager', modul: 'Assignment', permission: 'CRUD' },
      { role: 'Asset Manager', modul: 'Reports', permission: 'R' },
      { role: 'Maintenance Manager', modul: 'Maintenance Schedule', permission: 'CRUD' },
      { role: 'Maintenance Manager', modul: 'Work Orders', permission: 'CRUD' },
      { role: 'Technician', modul: 'Work Orders', permission: 'RU-S' },
      { role: 'Technician', modul: 'Spareparts', permission: 'CRU-S' },
      { role: 'Operator', modul: 'Work Orders', permission: 'CR-S' },
      { role: 'Operator', modul: 'Assets', permission: 'RU-S' },
      { role: 'Finance', modul: 'Costs', permission: 'CRUD' },
      { role: 'Auditor', modul: 'Assets', permission: 'R' }
    ],
    workflow: [
      'Asset → Assignment → Inspection → Maintenance Schedule → Work Order → Technician → Completion → Cost Recording'
    ]
  },

  // ===========================================================================
  // MT-19 — Event Management
  // ===========================================================================
  {
    id: 'MT-19',
    nama: 'Event Management',
    deskripsi: 'Blueprint seminar, konser, workshop, pendaftaran peserta, tiket/e-badge, pembicara, sponsor, dan sertifikat.',
    modulDanSection: [
      { modul: 'Events', sections: ['Event Details', 'Banner', 'Schedule Date', 'Category', 'Capacity'] },
      { modul: 'Venues', sections: ['Venue Name', 'Room Layout', 'Seating Chart', 'Facilities'] },
      { modul: 'Sessions', sections: ['Agenda / Rundown', 'Track', 'Time Slot', 'Room'] },
      { modul: 'Participants', sections: ['Attendee Directory', 'Registration Info', 'Badge Print'] },
      { modul: 'Tickets', sections: ['Ticket Tier (Early Bird/VIP)', 'Price', 'Quota', 'Voucher Promo'] },
      { modul: 'Registration', sections: ['Online Form', 'Custom Questionnaire', 'Confirmation Email'] },
      { modul: 'Speakers', sections: ['Speaker Bio', 'Photo', 'Session Assignment', 'Slide Upload'] },
      { modul: 'Sponsors', sections: ['Sponsor Tier (Platinum/Gold)', 'Logo', 'Booth Allocation'] },
      { modul: 'Payments', sections: ['Ticket Checkout', 'Payment Gateway', 'Invoice & E-Ticket'] },
      { modul: 'Check-in', sections: ['QR Scanner App', 'On-site Check-in', 'Attendance Log'] },
      { modul: 'Certificates', sections: ['Certificate Template', 'Auto-Generate PDF', 'Download Portal'] },
      { modul: 'Reports', sections: ['Ticket Revenue', 'Attendance Rate', 'Participant Demographics'] }
    ],
    roleDefault: ['Event Owner', 'Event Manager', 'Admin', 'Registration Staff', 'Finance', 'Event Staff', 'Speaker', 'Sponsor', 'Participant'],
    adminRoleGuidance: 'Untuk EO / kepanitiaan standar, gabung Event Owner dan Event Manager menjadi 1 role "Admin EO / Ketua Panitia". Pisahkan HANYA untuk festival skala besar dengan divisi terpisah.',
    roleToModule: [
      { role: 'Event Owner', modul: 'Events', permission: 'CRUD' },
      { role: 'Event Owner', modul: 'Tickets', permission: 'CRUD' },
      { role: 'Event Owner', modul: 'Reports', permission: 'R' },
      { role: 'Event Manager', modul: 'Events', permission: 'CRUD' },
      { role: 'Event Manager', modul: 'Sessions', permission: 'CRUD' },
      { role: 'Registration Staff', modul: 'Registration', permission: 'CRUD' },
      { role: 'Registration Staff', modul: 'Check-in', permission: 'CRUD' },
      { role: 'Event Staff', modul: 'Check-in', permission: 'CRUD' },
      { role: 'Finance', modul: 'Payments', permission: 'CRUD' },
      { role: 'Speaker', modul: 'Sessions', permission: 'RU-O' },
      { role: 'Sponsor', modul: 'Sponsors', permission: 'RU-O' },
      { role: 'Participant', modul: 'Tickets', permission: 'CR-O' },
      { role: 'Participant', modul: 'Registration', permission: 'CRU-O' },
      { role: 'Participant', modul: 'Certificates', permission: 'R-O' }
    ],
    workflow: [
      'Event Setup → Registration → Payment → Ticket → Check-in → Participation → Certificate'
    ]
  },

  // ===========================================================================
  // MT-20 — Custom Application
  // ===========================================================================
  {
    id: 'MT-20',
    nama: 'Custom Application',
    deskripsi: 'Blueprint fleksibel dan modular saat kebutuhan aplikasi tidak masuk ke dalam template spesifik MT-01 s/d MT-19.',
    modulDanSection: [
      { modul: 'Entity Builder', sections: ['Custom Tables', 'Primary Key', 'Audit Fields'] },
      { modul: 'Module Builder', sections: ['Navigation Grouping', 'Module Icon', 'Order'] },
      { modul: 'Field Builder', sections: ['Data Types (Text/Number/Date/Relational)', 'Validation Rules'] },
      { modul: 'Relationship Builder', sections: ['One-to-Many', 'Many-to-Many', 'Lookup Fields'] },
      { modul: 'Form Builder', sections: ['Layout Designer', 'Sections', 'Conditional Fields'] },
      { modul: 'Role Builder', sections: ['Custom Role Name', 'Role Archetype Assignment'] },
      { modul: 'Permission Builder', sections: ['Module CRUD Matrix', 'Section Visibility', 'Row-Level Scope'] },
      { modul: 'Workflow Builder', sections: ['Status Lifecycle', 'Action Transitions', 'Approvers'] },
      { modul: 'Notification Builder', sections: ['Email Trigger', 'In-App Toast', 'Webhook'] },
      { modul: 'Report Builder', sections: ['Filter Rules', 'Aggregation Metrics', 'Export Layout'] },
      { modul: 'Dashboard Builder', sections: ['Widget Grid', 'KPI Cards', 'Chart Visuals'] }
    ],
    roleDefault: ['Owner', 'Admin', 'Operator', 'Viewer'],
    adminRoleGuidance: 'Untuk aplikasi kustom standar, gabung Owner dan Admin menjadi 1 role "Admin" saja. Pisahkan HANYA jika diminta pembatasan hak kepemilikan terpisah.',
    roleToModule: [
      { role: 'Owner', modul: 'Entity Builder', permission: 'CRUD' },
      { role: 'Owner', modul: 'Role Builder', permission: 'CRUD' },
      { role: 'Owner', modul: 'Permission Builder', permission: 'CRUD' },
      { role: 'Admin', modul: 'Entity Builder', permission: 'CRUD' },
      { role: 'Admin', modul: 'Form Builder', permission: 'CRUD' },
      { role: 'Operator', modul: 'Form Builder', permission: 'CRU' },
      { role: 'Viewer', modul: 'Report Builder', permission: 'R' }
    ],
    workflow: [
      'Entity → Actor → Action → Status → Approval → Notification'
    ]
  },

  // ===========================================================================
  // MT-21 — Rental & Peminjaman (Rental & Lending)
  // ===========================================================================
  {
    id: 'MT-21',
    nama: 'Rental & Peminjaman',
    deskripsi: 'Blueprint aplikasi sewa sepeda, rental mobil/motor, sewa kamera/alat, persewaan perlengkapan outdoor, dan peminjaman buku perpustakaan.',
    modulDanSection: [
      {
        modul: 'Unit & Armada (Inventory)',
        sections: ['Katalog Unit', 'Detail Unit / Armada', 'Status Unit (Tersedia / Sedang Disewa / Servis)', 'Tarif Sewa (per Jam / Hari)', 'Riwayat Unit']
      },
      {
        modul: 'Penyewaan (Check-Out)',
        sections: ['Form Sewa Baru', 'Pilih Unit Tersedia', 'Data Penyewa & Kontak', 'Waktu Mulai & Estimasi Kembali', 'Uang Jaminan / Deposit', 'Konfirmasi Sewa']
      },
      {
        modul: 'Pengembalian (Check-In) & Denda',
        sections: ['Form Pengembalian Unit', 'Pilih Transaksi Aktif', 'Cek Kondisi Fisik & Kerusakan', 'Kalkulator Keterlambatan & Denda', 'Pengembalian Deposit / Pelunasan', 'Update Status Unit Kembali Tersedia']
      },
      {
        modul: 'Penyewa & Pelanggan',
        sections: ['Daftar Penyewa', 'Profil Penyewa', 'Riwayat Sewa & Pengembalian', 'Catatan Deposit Aktif']
      },
      {
        modul: 'Laporan & Keuangan',
        sections: ['Laporan Omset Sewa', 'Laporan Denda Keterlambatan', 'Tingkat Utilitas Unit', 'Laporan Kerusakan & Pemeliharaan']
      }
    ],
    roleDefault: ['Super Admin', 'Petugas Sewa', 'Penyewa'],
    adminRoleGuidance: 'Super Admin mengelola akun staf, role, permission, konfigurasi, dan seluruh data sistem. Petugas Sewa menangani pencatatan sewa, pembayaran, serah-terima, pengembalian, pemeriksaan kondisi, dan denda. Penyewa hanya mengakses katalog, pemesanan, pembayaran, dan riwayat miliknya.',
    roleToModule: [
      { role: 'Super Admin', modul: 'Unit & Armada (Inventory)', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Penyewaan (Check-Out)', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Pengembalian (Check-In) & Denda', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Penyewa & Pelanggan', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Laporan & Keuangan', permission: 'R' },

      { role: 'Petugas Sewa', modul: 'Unit & Armada (Inventory)', permission: 'R' },
      { role: 'Petugas Sewa', modul: 'Penyewaan (Check-Out)', permission: 'CRU' },
      { role: 'Petugas Sewa', modul: 'Pengembalian (Check-In) & Denda', permission: 'CRU' },
      { role: 'Petugas Sewa', modul: 'Penyewa & Pelanggan', permission: 'CRU' },
      { role: 'Petugas Sewa', modul: 'Laporan & Keuangan', permission: 'R-L' },

      { role: 'Penyewa', modul: 'Unit & Armada (Inventory)', permission: 'R' },
      { role: 'Penyewa', modul: 'Penyewaan (Check-Out)', permission: 'CR' },
      { role: 'Penyewa', modul: 'Pengembalian (Check-In) & Denda', permission: 'R' },
      { role: 'Penyewa', modul: 'Penyewa & Pelanggan', permission: 'R' },
      { role: 'Penyewa', modul: 'Laporan & Keuangan', permission: '-' }
    ],
    workflow: [
      'Penyewa memilih unit tersedia → Petugas mencatat sewa & uang jaminan (deposit) → Status unit beralih jadi "Sedang Disewa" → Penyewa mengembalikan unit → Petugas cek kondisi fisik & kalkulasi denda jika telat → Deposit diselesaikan & status unit kembali "Tersedia"'
    ]
  },

  // ===========================================================================
  // MT-22 — Konstruksi & Proyek Lapangan
  // ===========================================================================
  {
    id: 'MT-22',
    nama: 'Konstruksi & Proyek Lapangan',
    deskripsi: 'Blueprint aplikasi konstruksi: RAB, progres termin, subkontraktor, laporan lapangan, material site, dan opname pekerjaan.',
    modulDanSection: [
      { modul: 'Proyek', sections: ['Daftar Proyek', 'RAB (Rencana Anggaran Biaya)', 'Timeline & Milestone', 'Tim Proyek'] },
      { modul: 'Lapangan', sections: ['Laporan Harian', 'Foto & Lokasi', 'Kendala Lapangan', 'Cuaca & Kondisi'] },
      { modul: 'Material & Alat', sections: ['Material Site', 'Alat Berat', 'Permintaan Material', 'Pemakaian Material'] },
      { modul: 'Subkontraktor', sections: ['Data Subkontraktor', 'Kontrak Kerja', 'Progress Subkon', 'Pembayaran Termin'] },
      { modul: 'Keuangan', sections: ['Opname Progres', 'Termin Pembayaran', 'Kas Proyek', 'Retensi'] },
      { modul: 'Laporan', sections: ['Progres vs RAB', 'Biaya Proyek', 'Laporan Owner', 'Laporan Kendala'] }
    ],
    roleDefault: ['Super Admin', 'Direktur Proyek', 'Project Manager', 'Site Engineer', 'Pengawas Lapangan', 'Logistik Material', 'Finance', 'Subkontraktor'],
    adminRoleGuidance: 'Super Admin mengelola akun staf, role, permission, dan konfigurasi sistem. Project Manager mengelola proyek, RAB, dan tim. Super Admin tidak mengerjakan opname harian; itu tugas Site Engineer/Pengawas.',
    roleToModule: [
      { role: 'Super Admin', modul: 'Proyek', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Laporan', permission: 'R' },
      { role: 'Direktur Proyek', modul: 'Proyek', permission: 'R' },
      { role: 'Direktur Proyek', modul: 'Keuangan', permission: 'R' },
      { role: 'Direktur Proyek', modul: 'Laporan', permission: 'R' },
      { role: 'Project Manager', modul: 'Proyek', permission: 'CRUD' },
      { role: 'Project Manager', modul: 'Subkontraktor', permission: 'CRUD' },
      { role: 'Project Manager', modul: 'Keuangan', permission: 'CRU' },
      { role: 'Site Engineer', modul: 'Lapangan', permission: 'CRUD' },
      { role: 'Site Engineer', modul: 'Material & Alat', permission: 'CRU' },
      { role: 'Pengawas Lapangan', modul: 'Lapangan', permission: 'CRUD' },
      { role: 'Pengawas Lapangan', modul: 'Proyek', permission: 'R' },
      { role: 'Logistik Material', modul: 'Material & Alat', permission: 'CRUD' },
      { role: 'Finance', modul: 'Keuangan', permission: 'CRUD' },
      { role: 'Finance', modul: 'Laporan', permission: 'R' },
      { role: 'Subkontraktor', modul: 'Subkontraktor', permission: 'RU-O' }
    ],
    workflow: [
      'RAB & rencana → pengadaan material → eksekusi & laporan harian → opname progres → termin pembayaran → serah terima'
    ]
  },

  // ===========================================================================
  // MT-23 — Pertanian & Agribisnis
  // ===========================================================================
  {
    id: 'MT-23',
    nama: 'Pertanian & Agribisnis',
    deskripsi: 'Blueprint aplikasi pertanian: lahan, siklus tanam, perawatan, panen, grading, stok hasil, dan penjualan komoditas.',
    modulDanSection: [
      { modul: 'Lahan', sections: ['Data Lahan/Kebun', 'Pemetaan Blok', 'Riwayat Musim', 'Status Lahan'] },
      { modul: 'Budidaya', sections: ['Rencana Tanam', 'Perawatan', 'Pemupukan', 'Pengendalian Hama', 'Panen'] },
      { modul: 'Hasil', sections: ['Hasil Panen per Lahan', 'Grading Kualitas', 'Stok Gudang', 'Susut/Kehilangan'] },
      { modul: 'Penjualan', sections: ['Harga Komoditas', 'Pesanan Pembeli', 'Pengiriman Hasil', 'Piutang Pembeli'] },
      { modul: 'Keuangan', sections: ['Biaya Produksi', 'Pendapatan', 'Laba per Lahan'] },
      { modul: 'Laporan', sections: ['Produktivitas', 'Analisis Musim', 'Prediksi Panen'] }
    ],
    roleDefault: ['Super Admin', 'Pemilik', 'Mandor', 'Petani', 'Logistik Gudang', 'Pembeli'],
    adminRoleGuidance: 'Super Admin mengelola akun staf, role, permission, dan master data sistem. Pemilik memantau hasil dan keuangan. Mandor mengatur jadwal kerja lapangan; Petani mencatat aktivitas harian.',
    roleToModule: [
      { role: 'Super Admin', modul: 'Lahan', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Keuangan', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Laporan', permission: 'R' },
      { role: 'Pemilik', modul: 'Keuangan', permission: 'R' },
      { role: 'Pemilik', modul: 'Laporan', permission: 'R' },
      { role: 'Pemilik', modul: 'Penjualan', permission: 'R' },
      { role: 'Mandor', modul: 'Budidaya', permission: 'CRUD' },
      { role: 'Mandor', modul: 'Lahan', permission: 'R' },
      { role: 'Petani', modul: 'Budidaya', permission: 'CRU' },
      { role: 'Logistik Gudang', modul: 'Hasil', permission: 'CRUD' },
      { role: 'Logistik Gudang', modul: 'Penjualan', permission: 'CRU' },
      { role: 'Pembeli', modul: 'Penjualan', permission: 'CR-O' },
      { role: 'Pembeli', modul: 'Hasil', permission: 'R' }
    ],
    workflow: [
      'Rencana tanam → perawatan & pemupukan → panen → grading kualitas → masuk gudang → jual/distribusi → catat hasil & biaya'
    ]
  },

  // ===========================================================================
  // MT-24 — Layanan Publik & Pemerintahan
  // ===========================================================================
  {
    id: 'MT-24',
    nama: 'Layanan Publik & Pemerintahan',
    deskripsi: 'Blueprint aplikasi layanan publik: pengajuan warga, verifikasi berkas, disposisi pejabat, SLA layanan, pengaduan, dan arsip dokumen.',
    modulDanSection: [
      { modul: 'Layanan', sections: ['Jenis Layanan', 'Persyaratan Dokumen', 'Pengajuan Warga', 'Kuota Layanan'] },
      { modul: 'Verifikasi', sections: ['Triage Berkas', 'Disposisi Pejabat', 'Persetujuan', 'Penolakan & Alasan'] },
      { modul: 'Pelacakan', sections: ['Status Pengajuan', 'SLA Layanan', 'Riwayat Proses', 'Notifikasi Pemohon'] },
      { modul: 'Pengaduan', sections: ['Form Pengaduan', 'Tindak Lanjut', 'Eskalasi', 'Kepuasan Pemohon'] },
      { modul: 'Dokumen', sections: ['Arsip Digital', 'Template Surat', 'Tanda Tangan Pejabat'] },
      { modul: 'Laporan', sections: ['Statistik Layanan', 'Kinerja SLA', 'Laporan Pengaduan'] }
    ],
    roleDefault: ['Super Admin', 'Kepala Dinas', 'Pejabat Disposisi', 'Petugas Loket', 'Verifikator', 'Warga'],
    adminRoleGuidance: 'Super Admin mengelola akun staf, role, permission, jenis layanan, dan konfigurasi sistem. Pejabat hanya melakukan disposisi/persetujuan; Petugas Loket dan Verifikator menangani proses harian.',
    roleToModule: [
      { role: 'Super Admin', modul: 'Layanan', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Dokumen', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Laporan', permission: 'R' },
      { role: 'Kepala Dinas', modul: 'Laporan', permission: 'R' },
      { role: 'Kepala Dinas', modul: 'Verifikasi', permission: 'A' },
      { role: 'Pejabat Disposisi', modul: 'Verifikasi', permission: 'RU' },
      { role: 'Petugas Loket', modul: 'Layanan', permission: 'CRU' },
      { role: 'Petugas Loket', modul: 'Pelacakan', permission: 'R' },
      { role: 'Verifikator', modul: 'Verifikasi', permission: 'CRU' },
      { role: 'Verifikator', modul: 'Dokumen', permission: 'CRU' },
      { role: 'Warga', modul: 'Layanan', permission: 'CR-O' },
      { role: 'Warga', modul: 'Pelacakan', permission: 'R-O' },
      { role: 'Warga', modul: 'Pengaduan', permission: 'CR-O' }
    ],
    workflow: [
      'Warga ajukan → verifikasi berkas → disposisi pejabat → proses layanan → selesai & arsip → pengaduan bila ada'
    ]
  },

  // ===========================================================================
  // MT-25 — Media & Konten Digital
  // ===========================================================================
  {
    id: 'MT-25',
    nama: 'Media & Konten Digital',
    deskripsi: 'Blueprint aplikasi media: kalender editorial, produksi & approval konten, publikasi multi-channel, engagement audiens, dan monetisasi sponsor.',
    modulDanSection: [
      { modul: 'Editorial', sections: ['Kalender Editorial', 'Ide Konten', 'Approval Konten', 'Brief Konten'] },
      { modul: 'Produksi', sections: ['Draft Konten', 'Revisi', 'Jadwal Publikasi', 'Aset Media'] },
      { modul: 'Publikasi', sections: ['Channel', 'Publikasi Konten', 'Arsip Konten', 'Penjadwalan'] },
      { modul: 'Audiens', sections: ['Data Subscriber', 'Engagement Metric', 'Feedback Komentar'] },
      { modul: 'Monetisasi', sections: ['Sponsor & Ads Slot', 'Kontrak Sponsor', 'Laporan Campaign'] },
      { modul: 'Laporan', sections: ['Performa Konten', 'Pertumbuhan Audiens', 'Pendapatan Iklan'] }
    ],
    roleDefault: ['Super Admin', 'Editor', 'Content Creator', 'Approver', 'Sponsor', 'Subscriber'],
    adminRoleGuidance: 'Super Admin mengelola akun staf, role, permission, dan konfigurasi. Editor mengatur kalender dan approval konten; Content Creator memproduksi draft. Sponsor hanya melihat laporan campaign miliknya.',
    roleToModule: [
      { role: 'Super Admin', modul: 'Editorial', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Monetisasi', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Laporan', permission: 'R' },
      { role: 'Editor', modul: 'Editorial', permission: 'CRUD' },
      { role: 'Editor', modul: 'Publikasi', permission: 'CRUD' },
      { role: 'Content Creator', modul: 'Produksi', permission: 'CRUD' },
      { role: 'Content Creator', modul: 'Editorial', permission: 'CR' },
      { role: 'Approver', modul: 'Editorial', permission: 'A' },
      { role: 'Approver', modul: 'Laporan', permission: 'R' },
      { role: 'Sponsor', modul: 'Monetisasi', permission: 'R-O' },
      { role: 'Subscriber', modul: 'Audiens', permission: 'R-O' },
      { role: 'Subscriber', modul: 'Publikasi', permission: 'R' }
    ],
    workflow: [
      'Ide konten → draft → review/approval → jadwal publikasi → publikasi → pantau engagement → monetisasi sponsor'
    ]
  },

  // ===========================================================================
  // MT-26 — Asuransi & Klaim
  // ===========================================================================
  {
    id: 'MT-26',
    nama: 'Asuransi & Klaim',
    deskripsi: 'Blueprint aplikasi asuransi: pengajuan polis, underwriting, premi berkala, klaim, investigasi, keputusan kompensasi, dan komisi agen.',
    modulDanSection: [
      { modul: 'Polis', sections: ['Produk Asuransi', 'Pengajuan Polis', 'Underwriting', 'Polis Aktif', 'Perpanjangan Polis'] },
      { modul: 'Premi', sections: ['Jadwal Premi', 'Pembayaran Premi', 'Tunggakan', 'Kwitansi'] },
      { modul: 'Klaim', sections: ['Form Klaim', 'Verifikasi Dokumen', 'Investigasi', 'Keputusan Klaim'] },
      { modul: 'Kompensasi', sections: ['Perhitungan Kompensasi', 'Approval Kompensasi', 'Pembayaran Klaim'] },
      { modul: 'Agen', sections: ['Data Agen', 'Komisi Agen', 'Target Agen'] },
      { modul: 'Laporan', sections: ['Portofolio Polis', 'Rasio Klaim', 'Pendapatan Premi', 'Aging Premi'] }
    ],
    roleDefault: ['Super Admin', 'Manajer Asuransi', 'Agen', 'Underwriter', 'Adjuster', 'Finance', 'Pemegang Polis'],
    adminRoleGuidance: 'Super Admin mengelola akun staf, role, permission, produk, dan konfigurasi. Manajer memantau portofolio; Underwriter menilai risiko; Adjuster menginvestigasi klaim. Keputusan kompensasi butuh approval berjenjang.',
    roleToModule: [
      { role: 'Super Admin', modul: 'Polis', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Laporan', permission: 'R' },
      { role: 'Manajer Asuransi', modul: 'Polis', permission: 'CRU' },
      { role: 'Manajer Asuransi', modul: 'Kompensasi', permission: 'A' },
      { role: 'Manajer Asuransi', modul: 'Laporan', permission: 'R' },
      { role: 'Agen', modul: 'Polis', permission: 'CR-O' },
      { role: 'Agen', modul: 'Agen', permission: 'R-O' },
      { role: 'Underwriter', modul: 'Polis', permission: 'CRU' },
      { role: 'Adjuster', modul: 'Klaim', permission: 'CRU' },
      { role: 'Finance', modul: 'Premi', permission: 'CRUD' },
      { role: 'Finance', modul: 'Kompensasi', permission: 'CRU' },
      { role: 'Pemegang Polis', modul: 'Polis', permission: 'R-O' },
      { role: 'Pemegang Polis', modul: 'Premi', permission: 'R-O' },
      { role: 'Pemegang Polis', modul: 'Klaim', permission: 'CR-O' }
    ],
    workflow: [
      'Pengajuan polis → underwriting → polis aktif → premi berkala → klaim → verifikasi & investigasi → keputusan → kompensasi'
    ]
  },

  // ===========================================================================
  // MT-27 — E-commerce Marketplace
  // ===========================================================================
  {
    id: 'MT-27',
    nama: 'E-commerce Marketplace',
    deskripsi: 'Blueprint marketplace multi-seller: katalog, checkout escrow, pengiriman, pelepasan dana ke seller, dispute, dan rating.',
    modulDanSection: [
      { modul: 'Seller', sections: ['Pendaftaran Seller', 'Verifikasi Toko', 'Komisi', 'Performa Seller'] },
      { modul: 'Produk', sections: ['Katalog Multi-Seller', 'Kategori', 'Stok Seller', 'Harga & Promo'] },
      { modul: 'Pesanan', sections: ['Keranjang', 'Checkout', 'Escrow Dana', 'Riwayat Pesanan'] },
      { modul: 'Pengiriman', sections: ['Pilih Kurir', 'Tracking Pengiriman', 'Konfirmasi Terima', 'Pengembalian Barang'] },
      { modul: 'Sengketa', sections: ['Dispute Buyer-Seller', 'Mediasi', 'Refund', 'Keputusan Admin'] },
      { modul: 'Ulasan', sections: ['Rating Produk', 'Ulasan Seller', 'Laporan Ulasan'] },
      { modul: 'Laporan', sections: ['GMV', 'Komisi Marketplace', 'Transaksi per Seller'] }
    ],
    roleDefault: ['Super Admin', 'Admin Marketplace', 'Seller', 'Buyer', 'Kurir'],
    adminRoleGuidance: 'Super Admin mengelola akun staf, role, permission, dan konfigurasi platform. Admin Marketplace memoderasi seller, dispute, dan komisi. Seller hanya mengelola toko & produknya; Buyer hanya data pesanannya.',
    roleToModule: [
      { role: 'Super Admin', modul: 'Seller', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Laporan', permission: 'R' },
      { role: 'Admin Marketplace', modul: 'Sengketa', permission: 'CRUD' },
      { role: 'Admin Marketplace', modul: 'Seller', permission: 'CRU' },
      { role: 'Admin Marketplace', modul: 'Laporan', permission: 'R' },
      { role: 'Seller', modul: 'Produk', permission: 'CRUD-O' },
      { role: 'Seller', modul: 'Pesanan', permission: 'RU-O' },
      { role: 'Seller', modul: 'Seller', permission: 'RU-O' },
      { role: 'Buyer', modul: 'Pesanan', permission: 'CR-O' },
      { role: 'Buyer', modul: 'Ulasan', permission: 'CR-O' },
      { role: 'Kurir', modul: 'Pengiriman', permission: 'RU-S' }
    ],
    workflow: [
      'Seller daftar → upload produk → buyer checkout & bayar (escrow) → kirim → buyer terima → dana dilepas ke seller → ulasan'
    ]
  },

  // ===========================================================================
  // MT-28 — NGO & Nonprofit
  // ===========================================================================
  {
    id: 'MT-28',
    nama: 'NGO & Nonprofit',
    deskripsi: 'Blueprint organisasi nonprofit: donasi, rekap dana, program bantuan, penyaluran ke penerima manfaat, relawan, dan laporan transparansi.',
    modulDanSection: [
      { modul: 'Donatur', sections: ['Data Donatur', 'Riwayat Donasi', 'Donatur Rutin'] },
      { modul: 'Donasi', sections: ['Form Donasi', 'Konfirmasi Donasi', 'Rekap Dana', 'Kwitansi Donasi'] },
      { modul: 'Program', sections: ['Program & Kegiatan', 'Penerima Manfaat', 'Target Program', 'Realisasi Program'] },
      { modul: 'Penyaluran', sections: ['Rencana Penyaluran', 'Realisasi Penyaluran', 'Bukti Penyaluran', 'Dokumentasi'] },
      { modul: 'Relawan', sections: ['Data Relawan', 'Jadwal Relawan', 'Kontribusi Relawan'] },
      { modul: 'Transparansi', sections: ['Laporan Dana', 'Laporan Dampak', 'Publikasi Laporan'] }
    ],
    roleDefault: ['Super Admin', 'Pengurus', 'Fundraiser', 'Relawan', 'Donatur', 'Penerima Manfaat'],
    adminRoleGuidance: 'Super Admin mengelola akun staf, role, permission, dan konfigurasi. Pengurus menetapkan program dan menyetujui penyaluran. Fundraiser menghimpun donasi; Donatur hanya melihat riwayat donasinya.',
    roleToModule: [
      { role: 'Super Admin', modul: 'Donasi', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Transparansi', permission: 'CRUD' },
      { role: 'Pengurus', modul: 'Program', permission: 'CRUD' },
      { role: 'Pengurus', modul: 'Penyaluran', permission: 'A' },
      { role: 'Pengurus', modul: 'Transparansi', permission: 'R' },
      { role: 'Fundraiser', modul: 'Donasi', permission: 'CRU' },
      { role: 'Fundraiser', modul: 'Donatur', permission: 'CRU' },
      { role: 'Relawan', modul: 'Relawan', permission: 'RU-O' },
      { role: 'Relawan', modul: 'Penyaluran', permission: 'R' },
      { role: 'Donatur', modul: 'Donasi', permission: 'CR-O' },
      { role: 'Donatur', modul: 'Transparansi', permission: 'R' },
      { role: 'Penerima Manfaat', modul: 'Program', permission: 'R-O' }
    ],
    workflow: [
      'Donatur donasi → rekap dana → rencana program → penyaluran ke penerima manfaat → dokumentasi → laporan transparansi'
    ]
  },

  // ===========================================================================
  // MT-29 — Laundry & Jasa Pencucian
  // ===========================================================================
  {
    id: 'MT-29',
    nama: 'Laundry & Jasa Pencucian',
    deskripsi: 'Blueprint aplikasi laundry & cuci: penerimaan cucian kiloan/satuan, penimbangan berat, antrean proses (cuci, kering, setrika), lacak nomor resi mandiri oleh pelanggan, kasir pembayaran, dan rak penyimpanan.',
    modulDanSection: [
      { modul: 'Kasir & Order', sections: ['Penerimaan Cucian Baru', 'Timbangan & Hitung Biaya', 'Cetak Nota Resi', 'Pembayaran & Kasir'] },
      { modul: 'Pengerjaan Cuci', sections: ['Papan Antrean Cuci', 'Proses Cuci', 'Pengeringan', 'Setrika & Finishing', 'Siap Diambil'] },
      { modul: 'Pelacakan', sections: ['Lacak Resi Mandiri', 'Status Progres Cucian', 'Detail Pakaian & Catatan Noda'] },
      { modul: 'Gudang & Rak', sections: ['Penataan Rak Ambil', 'Pengambilan Cucian', 'Riwayat Selesai'] },
      { modul: 'Laporan', sections: ['Omset Harian', 'Total Berat Cucian (Kg)', 'Performa Petugas Cuci', 'Metode Pembayaran'] }
    ],
    roleDefault: ['Super Admin', 'Kasir Laundry', 'Washer / Petugas Cuci', 'Pelanggan', 'Pemilik Laundry'],
    adminRoleGuidance: 'Super Admin mengelola akun staf, role, permission, dan tarif layanan laundry. Kasir menerima cucian dan pembayaran. Washer memperbarui tahapan cuci dan setrika. Pelanggan melacak status cucian via nomor resi.',
    roleToModule: [
      { role: 'Super Admin', modul: 'Kasir & Order', permission: 'CRUD' },
      { role: 'Super Admin', modul: 'Laporan', permission: 'R' },
      { role: 'Kasir Laundry', modul: 'Kasir & Order', permission: 'CRUD' },
      { role: 'Kasir Laundry', modul: 'Gudang & Rak', permission: 'CRUD' },
      { role: 'Washer / Petugas Cuci', modul: 'Pengerjaan Cuci', permission: 'CRU' },
      { role: 'Pelanggan', modul: 'Pelacakan', permission: 'R' }
    ],
    workflow: [
      'Pelanggan bawa pakaian → kasir timbang & terbitkan resi → washer cuci & setrika → update siap diambil → pelanggan ambil cucian & bayar'
    ]
  }
];


// =============================================================================
// QUERY & IDEATION INTEGRATION HELPERS (FASE B)
// =============================================================================

/**
 * Mencari Master Template berdasarkan MT-ID (misal: "MT-04")
 */
export function getMasterTemplateById(id: string): MasterTemplate | undefined {
  const cleanId = id.trim().toUpperCase();
  const template = MASTER_TEMPLATES.find(t => t.id.toUpperCase() === cleanId);
  if (!template) return undefined;

  return {
    ...template,
    roleDefault: ensureRequiredSystemRole(template.roleDefault),
    roleToModule: template.roleToModule.map((entry) => ({
      ...entry,
      role: normalizeRoleName(entry.role)
    }))
  };
}

/**
 * Mendapatkan seluruh daftar Master Template
 */
export function getAllMasterTemplates(): MasterTemplate[] {
  return MASTER_TEMPLATES.map((template) => getMasterTemplateById(template.id) as MasterTemplate);
}

/**
 * Menghasilkan katalog ringkas seluruh Master Template (1 baris per template)
 * untuk disematkan di IDEATION_SYSTEM_PROMPT tanpa membebani ukuran prompt.
 */
export function getConciseCatalogSummary(): string {
  return MASTER_TEMPLATES.map(t => `- ${t.id} (${t.nama}): ${t.deskripsi}`).join('\n');
}

export interface TemplateMatchResult {
  template: MasterTemplate;
  matchedVariant?: string;
}

/**
 * Mendeteksi Master Template yang paling cocok dari teks prompt / riwayat pengguna
 */
export function detectMatchingMasterTemplate(text: string): TemplateMatchResult | null {
  const lower = text.toLowerCase();

  // 1. Cek Varian Khusus Terlebih Dahulu
  if (lower.includes('laundry') || lower.includes('cuci pakaian') || lower.includes('cuci baju') || lower.includes('cuci sepatu') || lower.includes('cuci helm') || lower.includes('dry clean') || lower.includes('penatu')) {
    const t = getMasterTemplateById('MT-29');
    if (t) return { template: t, matchedVariant: 'Laundry' };
  }
  if (lower.includes('barber') || lower.includes('pangkas rambut') || lower.includes('potong rambut')) {
    const t = getMasterTemplateById('MT-04');
    if (t) return { template: t, matchedVariant: 'Barbershop' };
  }
  if (lower.includes('salon')) {
    const t = getMasterTemplateById('MT-04');
    if (t) return { template: t, matchedVariant: 'Salon' };
  }
  if (lower.includes('spa') || lower.includes('massage') || lower.includes('pijat') || lower.includes('refleksi')) {
    const t = getMasterTemplateById('MT-04');
    if (t) return { template: t, matchedVariant: 'Spa' };
  }
  if (lower.includes('penitipan kucing') || lower.includes('penitipan anjing') || lower.includes('penitipan hewan') || lower.includes('pet hotel') || lower.includes('pet care') || lower.includes('penitipan peliharaan') || lower.includes('hotel hewan')) {
    const t = getMasterTemplateById('MT-09');
    if (t) return { template: t, matchedVariant: 'Pet Hotel & Penitipan Hewan' };
  }

  // 2. Cek Berdasarkan Kata Kunci Pola Bisnis Industri
  const keywordMappings: { keywords: string[]; mtId: string }[] = [
    {
      keywords: ['penitipan kucing', 'penitipan anjing', 'penitipan hewan', 'pet hotel', 'pet care', 'penitipan peliharaan', 'hotel hewan', 'penitipan'],
      mtId: 'MT-09'
    },
    {
      keywords: ['laundry', 'cuci pakaian', 'cuci baju', 'cuci sepatu', 'cuci helm', 'cuci karpet', 'dry clean', 'penatu', 'cucian'],
      mtId: 'MT-29'
    },
    {
      keywords: ['janji temu', 'appointment', 'booking service', 'grooming', 'cleaning service', 'penjahit', 'tailor'],
      mtId: 'MT-04'
    },
    {
      keywords: ['klinik', 'puskesmas', 'dokter', 'rekam medis', 'pasien', 'poli', 'apotek', 'farmasi', 'bidan', 'dokter gigi', 'optik', 'fisioterapi', 'kesehatan'],
      mtId: 'MT-06'
    },
    {
      keywords: ['restoran', 'resto', 'cafe', 'kafe', 'rumah makan', 'warung makan', 'kedai kopi', 'coffee shop', 'katering', 'catering', 'bakery', 'f&b', 'kuliner'],
      mtId: 'MT-03'
    },
    {
      keywords: ['bengkel', 'servis motor', 'servis mobil', 'mekanik', 'montir', 'sparepart', 'reparasi hp', 'service center', 'ganti oli', 'reparasi'],
      mtId: 'MT-05'
    },
    {
      keywords: ['retail', 'ritel', 'toko', 'kasir pos', 'minimarket', 'warung', 'kelontong', 'pos kasir', 'penjualan barang', 'sembako', 'butik', 'petshop'],
      mtId: 'MT-01'
    },
    {
      keywords: ['grosir', 'distributor', 'wholesale', 'gudang distribusi', 'supply chain', 'b2b sales', 'agen sembako'],
      mtId: 'MT-02'
    },
    {
      keywords: ['hotel', 'villa', 'guest house', 'homestay', 'penginapan', 'kost', 'reservasi kamar', 'booking kamar', 'glamping', 'resort'],
      mtId: 'MT-09'
    },
    {
      keywords: ['sekolah', 'bimbel', 'bimbingan belajar', 'kursus', 'les privat', 'kampus', 'universitas', 'pesantren', 'madrasah', 'rapor', 'spp siswa'],
      mtId: 'MT-10'
    },
    {
      keywords: ['gym', 'fitness', 'fitness center', 'membership', 'member card', 'sanggar senam', 'yoga studio', 'iuran member', 'langganan'],
      mtId: 'MT-15'
    },
    {
      keywords: ['ekspedisi', 'kurir', 'logistik', 'pengiriman barang', 'resi paket', 'armada kurir', 'tracking paket', 'delivery order', 'cod paket'],
      mtId: 'MT-14'
    },
    {
      keywords: [
        'sewa sepeda', 'rental sepeda', 'sewa mobil', 'rental mobil', 'sewa motor', 'rental motor',
        'sewa kamera', 'rental kamera', 'sewa alat', 'rental alat', 'persewaan', 'sewa tenda',
        'peminjaman buku', 'pinjam buku', 'perpustakaan', 'sewa kostum', 'sewa gaun',
        'rental', 'sewa', 'peminjaman', 'pinjam'
      ],
      mtId: 'MT-21'
    },
    {
      keywords: ['properti', 'sewa gedung', 'sewa apartemen', 'sewa ruko', 'sewa kos', 'kontrak penyewa', 'estate management'],
      mtId: 'MT-13'
    },
    {
      keywords: ['hris', 'manajemen sdm', 'payroll gaji', 'absensi karyawan', 'cuti karyawan', 'rekrutmen karyawan', 'slip gaji', 'kpi karyawan'],
      mtId: 'MT-16'
    },
    {
      keywords: ['crm', 'sales pipeline', 'lead management', 'deal pipeline', 'follow up customer', 'prospek penjualan'],
      mtId: 'MT-11'
    },
    {
      keywords: ['akuntansi', 'pembukuan', 'buku besar', 'jurnal keuangan', 'laba rugi', 'neraca', 'kas bank', 'petty cash', 'ar ap', 'faktur pajak'],
      mtId: 'MT-12'
    },
    {
      keywords: ['pabrik', 'manufaktur', 'produksi barang', 'perakitan', 'konveksi', 'garmen', 'bill of materials', 'bom'],
      mtId: 'MT-07'
    },
    {
      keywords: ['project management', 'konsultan', 'agency', 'software house', 'kantor hukum', 'arsitek', 'timesheet', 'milestone project'],
      mtId: 'MT-08'
    },
    {
      keywords: ['pengadaan barang', 'procurement', 'purchase order', 'gudang inventori', 'stok opname', 'mutasi gudang', 'purchase request'],
      mtId: 'MT-17'
    },
    {
      keywords: ['manajemen aset', 'fixed asset', 'barcode aset', 'pemeliharaan mesin', 'preventive maintenance', 'work order teknisi'],
      mtId: 'MT-18'
    },
    {
      keywords: ['event organizer', 'seminar', 'webinar', 'workshop event', 'konser', 'tiket seminar', 'e-ticket', 'qr check-in', 'sertifikat event'],
      mtId: 'MT-19'
    },
    {
      keywords: ['konstruksi', 'kontraktor', 'pembangunan', 'proyek bangunan', 'rab', 'rencana anggaran biaya', 'site engineer', 'subkontraktor', 'opname pekerjaan', 'proyek lapangan'],
      mtId: 'MT-22'
    },
    {
      keywords: ['pertanian', 'kebun', 'ladang', 'panen', 'tanam', 'agribisnis', 'peternakan', 'komoditas', 'tani', 'pemupukan'],
      mtId: 'MT-23'
    },
    {
      keywords: ['layanan publik', 'pemerintah', 'pemerintahan', 'dinas', 'disposisi', 'surat menyurat', 'warga', 'kelurahan', 'kecamatan', 'pelayanan masyarakat'],
      mtId: 'MT-24'
    },
    {
      keywords: ['media', 'konten digital', 'editorial', 'penerbitan', 'artikel', 'publisher', 'content creator', 'monetisasi konten', 'audiens'],
      mtId: 'MT-25'
    },
    {
      keywords: ['asuransi', 'polis', 'premi', 'klaim', 'underwriting', 'pertanggungan', 'adjuster', 'pemegang polis'],
      mtId: 'MT-26'
    },
    {
      keywords: ['marketplace', 'e-commerce', 'ecommerce', 'multi-seller', 'seller', 'escrow', 'toko online', 'mall online'],
      mtId: 'MT-27'
    },
    {
      keywords: ['ngo', 'nonprofit', 'non-profit', 'donasi', 'donatur', 'organisasi sosial', 'yayasan', 'relawan', 'penerima manfaat'],
      mtId: 'MT-28'
    }
  ];

  for (const mapping of keywordMappings) {
    if (mapping.keywords.some(k => lower.includes(k))) {
      const t = getMasterTemplateById(mapping.mtId);
      if (t) return { template: t };
    }
  }

  return null;
}

/**
 * Memformat detail ringkas satu Master Template menjadi konteks terstruktur

 * untuk disuntikkan ke IDEATION_SYSTEM_PROMPT di Tahap 1.
 * DILARANG menyebutkan kode "MT-XX" secara eksplisit agar tidak membingungkan pengguna.
 */
export function formatTemplateContextForIdeation(match: TemplateMatchResult): string {
  const { template: t, matchedVariant } = match;

  const moduleSectionsText = t.modulDanSection
    .map(m => `  * ${m.modul}: section ${m.sections.join(', ')}`)
    .join('\n');

  // Template lama masih menyimpan beberapa lapisan admin. Keluarkan hanya
  // Super Admin sebagai role sistem; Owner/Manager tetap dapat ditambahkan
  // jika konteks pengguna memang membutuhkannya.
  const suggestedBusinessRoles = t.roleDefault.filter((role) =>
    !/^(?:admin|super\s*admin|owner|manager)$/i.test(role.trim())
  );
  const rolesSummary = ensureRequiredSystemRole(suggestedBusinessRoles)
    .map(r => `  * Role ${r}`)
    .join(', ');

  const adminNotice = `\nRole Sistem Wajib: ${REQUIRED_SYSTEM_ROLE} (satu-satunya role yang mengelola akun staf, role, dan permission)`;

  let variantNotice = '';
  if (matchedVariant) {
    const v = t.variant?.find(item => item.nama.toLowerCase() === matchedVariant.toLowerCase());
    if (v) {
      variantNotice = ` (Varian: "${v.nama}" - ${v.tambahan.join(', ')})`;
    }
  }

  return `
=== ACUAN STRUKTUR BAKU (INTERNAL REFERENCE) ===
Pola Bisnis: "${t.nama}" (${t.deskripsi})${variantNotice}
Modul & Section:
${moduleSectionsText}
Rekomendasi Role: ${rolesSummary}${adminNotice}
Alur Kerja: ${t.workflow.slice(0, 4).join(' → ')}

 PANDUAN EKSPLORASI & KONSOLIDASI ROLE:
 1. Gunakan modul & section di atas untuk mengusulkan peran dan alur secara konkret (2-4 kalimat). DILARANG bertanya terbuka. DILARANG menyebutkan kode internal kepada pengguna.
 2. Selalu mulai dari role sistem "Super Admin", lalu tambahkan role bisnis/operasional yang relevan.
 3. Jangan menggunakan role generik "Admin". Untuk kegiatan harian gunakan nama pekerjaan seperti "Petugas", "Kasir", atau "Petugas Sewa".
 4. Owner dan Manager bersifat opsional dan tidak boleh diberi akses membuat akun staf atau mengubah permission.`;
}
