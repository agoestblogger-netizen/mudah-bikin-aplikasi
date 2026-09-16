# Test Suite Manifest: Mudah Bikin Aplikasi (Vue 3 Pipeline)

Dokumen ini berisi daftar lengkap seluruh test aktif dalam test suite permanen proyek **Mudah Bikin Aplikasi**, arsitektur yang diuji, cakupan validasi, dan instruksi eksekusi.

---

## 1. Cara Menjalankan Test Suite

### Menjalankan Seluruh Test Suite (Master Runner)
```bash
npm test
# atau
npx tsx tests/run_all.ts
```

### Menjalankan Test Individual
```bash
npx tsx tests/tailwind_v2_whitelist.test.ts
npx tsx tests/vue_validators_6a_6b_6d.test.ts
npx tsx tests/kursus_mobil_skema_asli.test.ts
npx tsx tests/owner_role_dynamic.test.ts
npx tsx tests/vue_scaffold_node.test.ts
npx tests/vue_wrapper.test.ts
npx tsx tests/targeted_repair_integrity.test.ts
npx tsx tests/rbac_ui_fixes.test.ts
npx tsx tests/sales_prospek_crm.test.ts
npx tsx tests/multi_schema_isolation.test.ts
```

---

## 2. Daftar 10 Test Suite Aktif & Cakupan Pengujian

| No | File Test | Fokus & Cakupan Pengujian | Status |
|---|---|---|---|
| **1** | [`tests/tailwind_v2_whitelist.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/tailwind_v2_whitelist.test.ts) | **Tailwind CSS v2 Whitelist Enforcement**<br>Memverifikasi 39.062 kelas precompiled dari `tailwind.min.css` v2.2.19. Memastikan arbitrary values `[...]` (misal `min-h-[70vh]`, `grid-cols-[1fr_2fr]`) dan utility Tailwind v3+/v4+ (seperti `file:*`, `aspect-*`, `columns-*`) langsung ditolak dan dilaporkan sebagai pelanggaran whitelist. | ✅ PASS |
| **2** | [`tests/vue_validators_6a_6b_6d.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/vue_validators_6a_6b_6d.test.ts) | **Vue AST Parameterized CRUD & Safety Mixin**<br>Menguji validasi AST pada blok `methods: {}` komponen Vue 3 Options API. Menguji generic branch untuk Create (`openCreate`, `saveModalData`), Edit (`openEdit`), dan Delete (`confirmDelete`, `executeDelete`), serta auto-repair mixin bridge. | ✅ PASS |
| **3** | [`tests/kursus_mobil_skema_asli.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/kursus_mobil_skema_asli.test.ts) | **End-to-End Skema Kursus Menyetir Mobil**<br>Menguji skema asli dari sesi guided interview (4 roles: Super Admin, Admin Pendaftaran, Instruktur Mengemudi, Murid; 4 tables: pengguna, paket_kursus, jadwal_sesi, laporan_sesi). Memastikan 0 SYNTAX_ERROR, 0 MISMATCH_HANDLER, 0 TAILWIND_V2_VIOLATION, dan efisiensi token ~70% lebih ringkas dibanding Vanilla JS lama. | ✅ PASS |
| **4** | [`tests/owner_role_dynamic.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/owner_role_dynamic.test.ts) | **Dynamic Owner Role Resolution**<br>Menguji resolusi dinamis peran utama (Owner) non-Super Admin (seperti `Ketua Koperasi`, `Dokter`, `Admin Bengkel`, dll). Memastikan generator dan validator tidak bergantung pada hardcoded string 'Super Admin'. | ✅ PASS |
| **5** | [`tests/vue_scaffold_node.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/vue_scaffold_node.test.ts) | **Vue 3 CDN Scaffold & Deterministic Safety Bridge**<br>Menguji kerangka plumbing deterministik Pilar 1 di `buildSrcDoc.ts`. Memastikan injeksi safety mixin `window.VueSafetyMixin` dan CDN Vue 3 berjalan benar di dalam container sandbox iframe. | ✅ PASS |
| **6** | [`tests/vue_wrapper.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/vue_wrapper.test.ts) | **Vue Options API Object AST Traversal**<br>Menguji walker AST Acorn pada deklarasi objek komponen Vue (`Property` node). Memastikan nama-nama method di dalam `methods: { ... }` terekstraksi dengan tepat tanpa memunculkan false-positive mismatch handler. | ✅ PASS |
| **7** | [`tests/targeted_repair_integrity.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/targeted_repair_integrity.test.ts) | **Targeted Repair Integrity & DOM Elements**<br>Menguji mekanisme perbaikan terarah (targeted repair) agar tidak merusak struktur template HTML, memelihara integritas ID DOM penting, dan tidak menyisipkan conversational leaks / markdown wrapper. | ✅ PASS |
| **8** | [`tests/rbac_ui_fixes.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/rbac_ui_fixes.test.ts) | **RBAC Tab Gating & UI Consistency**<br>Memverifikasi isolasi hak akses UI per role menggunakan `v-show="isRoleAllowed(...)"` atau `data-access-roles`, serta memastikan akun demo dan form login berfungsi sesuai matriks hak akses. | ✅ PASS |
| **9** | [`tests/sales_prospek_crm.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/sales_prospek_crm.test.ts) | **Sales Prospek CRM Domain Regeneration**<br>Regenerasi penuh domain Sales CRM menggunakan pipeline Vue 3: 3 Roles (Sales Manager, Sales Executive, Klien / Prospek), 3 Tables (prospek_leads, aktivitas_kunjungan, penawaran_deals), Check-in GPS (`ambilLokasiGps`), Foto Bukti (`foto_kunjungan_url`), Approval Diskon (`setujuiDiskon`), Cetak Quotation (`cetakQuotation`), Pipeline Funnel, dan Leaderboard Sales. | ✅ PASS |
| **10** | [`tests/multi_schema_isolation.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/multi_schema_isolation.test.ts) | **Multi-Schema Execution & State Isolation**<br>Menguji eksekusi 3 skema berbeda (Kursus Menyetir Mobil, Sales Prospek CRM, Koperasi Simpan Pinjam) dalam 1 proses runtime berurutan. Membuktikan 0 kebocoran `tablesConfig`, 0 kebocoran `db` keys, dan 0 cross-contamination antar domain. | ✅ PASS |

---

## 3. Direktori Fixtures

Seluruh artefak kode HTML lengkap yang digunakan sebagai referensi pengujian disimpan di folder [`tests/fixtures/`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/fixtures):
- `tests/fixtures/kursus_menyetir_mobil.html`: Artefak implementasi domain Kursus Mobil (4 roles, 4 parameterized tables).
- `tests/fixtures/sales_prospek_crm.html`: Artefak implementasi domain Sales CRM (3 roles, 3 parameterized tables, GPS, Foto, Approval, Quotation, Funnel, Leaderboard).
- `tests/fixtures/koperasi_simpan_pinjam.html`: Artefak implementasi domain Koperasi Simpan Pinjam (3 roles, 3 parameterized tables, multi-role login, approval pinjaman).

---

## 4. Keputusan Mengenai Legacy Vanilla Tests (Suite 7-10 Lama)

Sesuai Keputusan Arsitektur Besar **FULL REPLACEMENT** (bukan hybrid):
1. Seluruh generator kode baru di `/api/generate/route.ts` 100% menghasilkan aplikasi Vue 3 Options API + Parameterized CRUD.
2. Tidak ada jalur di codebase yang menghasilkan atau memerlukan Vanilla JS AST walker untuk DOM event handlers statis (`onclick="..."` manual pada ratusan fungsi inline).
3. Suite 7-10 lama (`test_step6a_create_branch.mts` s/d `test_step6d_delete_action.mts`) yang menguji regex/AST Vanilla JS lama telah dipensiunkan/dihapus dari test suite aktif karena merupakan *dead code* dan digantikan sepenuhnya oleh `tests/vue_validators_6a_6b_6d.test.ts`.
