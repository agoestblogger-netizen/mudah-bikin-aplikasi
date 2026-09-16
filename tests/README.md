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

Master runner [`tests/run_all.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/run_all.ts) mengeksekusi **17 suite** secara berurutan (`execSync('npx tsx <file>')`) dan keluar dengan kode `1` bila ada satu suite pun gagal.

### Menjalankan Test Individual
```bash
npx tsx tests/tailwind_v4_lightweight_validator.test.ts
npx tsx tests/vue_validators_6a_6b_6d.test.ts
npx tsx tests/kursus_mobil_skema_asli.test.ts
npx tsx tests/owner_role_dynamic.test.ts
npx tsx tests/vue_scaffold_node.test.ts
npx tsx tests/vue_wrapper.test.ts
npx tsx tests/targeted_repair_integrity.test.ts
npx tsx tests/rbac_ui_fixes.test.ts
npx tsx tests/sales_prospek_crm.test.ts
npx tsx tests/multi_schema_isolation.test.ts
npx tsx tests/four_vue_bugs_fix.test.ts
npx tsx tests/role_tab_and_public_role.test.ts
npx tsx tests/schema_pattern_and_relation_integrity.test.ts
npx tsx tests/tw_plugin_and_simulasi_db.test.ts
npx tsx tests/actor_classification_and_owner_role.test.ts
npx tsx tests/bug1a_and_1b_fix.test.ts
npx tsx tests/product_variant_question.test.ts
npx tsx tests/laundry_schema_tabs_and_tailwind_active.test.ts
```

> Catatan: `npx tsx` (bukan `npx`) dipakai karena seluruh suite ditulis sebagai TypeScript dan mengimpor modul `src/` secara langsung.

---

## 2. Daftar 18 Test Suite Aktif & Cakupan Pengujian

Direktori [`tests/`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests) berisi **19 file** total: 18 file `*.test.ts` (terdaftar di bawah) + 1 master runner [`tests/run_all.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/run_all.ts).

| No | File Test | Fokus & Cakupan Pengujian | Status |
|---|---|---|---|
| **1** | [`tests/tailwind_v4_lightweight_validator.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/tailwind_v4_lightweight_validator.test.ts) | **Tailwind CSS v4 Lightweight Anti-Plugin Validator**<br>Memverifikasi validator modern Tailwind v4 Browser Build. Memastikan arbitrary values `[...]` (misal `w-[calc(100%-2rem)]`, `min-h-[70vh]`), modern utility v4 (`columns-3`, `aspect-square`), dan modern variants (`active:scale-95`, `disabled:opacity-50`, `focus-visible:ring-2`) **LOLOS** tanpa halangan whitelist statis, sementara kelas plugin non-core yang tidak ada di CDN browser (`scrollbar-hide`, `@tailwindcss/forms` `form-*`, `@tailwindcss/typography` `prose*`, `aspect-w-*`) **DITOLAK**. | ✅ PASS |
| **2** | [`tests/vue_validators_6a_6b_6d.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/vue_validators_6a_6b_6d.test.ts) | **Vue AST Parameterized CRUD & Safety Mixin**<br>Menguji validasi AST pada blok `methods: {}` komponen Vue 3 Options API. Menguji generic branch untuk Create (`openCreate`, `saveModalData`), Edit (`openEdit`), dan Delete (`confirmDelete`, `executeDelete`), serta auto-repair mixin bridge. | ✅ PASS |
| **3** | [`tests/kursus_mobil_skema_asli.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/kursus_mobil_skema_asli.test.ts) | **End-to-End Skema Kursus Menyetir Mobil**<br>Menguji skema asli dari sesi guided interview (4 roles: Super Admin, Admin Pendaftaran, Instruktur Mengemudi, Murid; 4 tables: pengguna, paket_kursus, jadwal_sesi, laporan_sesi). Memastikan 0 SYNTAX_ERROR, 0 MISMATCH_HANDLER, 0 TAILWIND_V2_VIOLATION, dan efisiensi token ~70% lebih ringkas dibanding Vanilla JS lama. | ✅ PASS |
| **4** | [`tests/owner_role_dynamic.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/owner_role_dynamic.test.ts) | **Dynamic Owner Role Resolution**<br>Menguji resolusi dinamis peran utama (Owner) non-Super Admin (seperti `Ketua Koperasi`, `Dokter`, `Admin Bengkel`, dll). Memastikan generator dan validator tidak bergantung pada hardcoded string 'Super Admin'. | ✅ PASS |
| **5** | [`tests/vue_scaffold_node.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/vue_scaffold_node.test.ts) | **Vue 3 CDN Scaffold & Deterministic Safety Bridge**<br>Menguji kerangka plumbing deterministik Pilar 1 di `buildSrcDoc.ts`. Memastikan injeksi safety mixin `window.VueSafetyMixin` dan CDN Vue 3 berjalan benar di dalam container sandbox iframe. | ✅ PASS |
| **6** | [`tests/vue_wrapper.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/vue_wrapper.test.ts) | **Vue Options API Object AST Traversal**<br>Menguji walker AST Acorn pada deklarasi objek komponen Vue (`Property` node). Memastikan nama-nama method di dalam `methods: { ... }` terekstraksi dengan tepat tanpa memunculkan false-positive mismatch handler. | ✅ PASS |
| **7** | [`tests/targeted_repair_integrity.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/targeted_repair_integrity.test.ts) | **Targeted Repair Integrity & DOM Elements**<br>Menguji mekanisme perbaikan terarah (targeted repair) agar tidak merusak struktur template HTML, memelihara integritas ID DOM penting, dan tidak menyisipkan conversational leaks / markdown wrapper. | ✅ PASS |
| **8** | [`tests/rbac_ui_fixes.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/rbac_ui_fixes.test.ts) | **RBAC Tab Gating & UI Consistency**<br>Memverifikasi isolasi hak akses UI per role menggunakan `v-show="isRoleAllowed(...)"` atau `data-access-roles`, serta memastikan akun demo dan form login berfungsi sesuai matriks hak akses. | ✅ PASS |
| **9** | [`tests/sales_prospek_crm.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/sales_prospek_crm.test.ts) | **Sales Prospek CRM Domain Regeneration**<br>Regenerasi penuh domain Sales CRM menggunakan pipeline Vue 3: 3 Roles (Sales Manager, Sales Executive, Klien / Prospek), 3 Tables (prospek_leads, aktivitas_kunjungan, penawaran_deals), Check-in GPS (`ambilLokasiGps`), Foto Bukti (`foto_kunjungan_url`), Approval Diskon (`setujuiDiskon`), Cetak Quotation (`cetakQuotation`), Pipeline Funnel, dan Leaderboard Sales. | ✅ PASS |
| **10** | [`tests/multi_schema_isolation.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/multi_schema_isolation.test.ts) | **Multi-Schema Execution & State Isolation**<br>Menguji eksekusi 3 skema berbeda (Kursus Menyetir Mobil, Sales Prospek CRM, Koperasi Simpan Pinjam) dalam 1 proses runtime berurutan. Membuktikan 0 kebocoran `tablesConfig`, 0 kebocoran `db` keys, dan 0 cross-contamination antar domain. | ✅ PASS |
| **11** | [`tests/four_vue_bugs_fix.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/four_vue_bugs_fix.test.ts) | **Four Real Vue Bugs Fixes & Fallback Safety**<br>Verifikasi perbaikan 4 bug nyata: (1) panel render di luar root app, (2) manipulasi DOM manual alih-alih reaktivitas Vue, (3) `canEditCurrentTab` tidak konsisten multi-role, (4) registrasi mixin keamanan yang gagal senyap. Memastikan semua punya jalur fallback aman. | ✅ PASS |
| **12** | [`tests/role_tab_and_public_role.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/role_tab_and_public_role.test.ts) | **Role Tab Navigation & Public Role Security Gate**<br>**Bug 1:** deteksi & auto-repair `ROLE_MISSING_TAB_NAVIGATION` (mis. Petugas Perawat Hewan) sehingga setiap role punya akses ke tab navigasinya. **Bug 2:** perbaikan false positive `PUBLIC_ROLE_UNFILTERED_ON_LOAD` pada gate reaktif `v-if` di root app Vue. | ✅ PASS |
| **13** | [`tests/schema_pattern_and_relation_integrity.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/schema_pattern_and_relation_integrity.test.ts) | **3-Tier Schema Pattern & Relation Integrity**<br>Memverifikasi pola **LAPIS 1** tabel katalog/master → **LAPIS 2** tabel pendaftaran penghubung (dua field relasi kunci) → **LAPIS 3** tabel turunan. Juga mendeteksi field `relasi ke <tabel>` yang menunjuk tabel tidak ada, serta auto-repair peran yang salah. | ✅ PASS |
| **14** | [`tests/tw_plugin_and_simulasi_db.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/tw_plugin_and_simulasi_db.test.ts) | **Tailwind Plugin Whitelist & Simulasi DB Quality**<br>**Bug A:** larangan kelas yang butuh plugin Tailwind (`scrollbar-hide`, dsb) + penggantian dengan CSS custom. **Bug B:** perbaikan semantik nilai Simulasi DB — kerusakan fisik (bukan "jalan") & konsistensi skala nominal antara deposit dan tagihan. | ✅ PASS |
| **15** | [`tests/actor_classification_and_owner_role.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/actor_classification_and_owner_role.test.ts) | **Actor Classification & Semantic Owner Role Resolution**<br>Klasifikasi Pelaku (`PENGGUNA_SISTEM` vs `ENTITAS_DATA`), sub-step klarifikasi aktor Bagian A, filter Bagian B, resolusi `ownerRole` berbasis AI alur, Skema Data entitas tanpa kredensial, & Simulasi DB tanpa akun demo untuk entitas. | ✅ PASS |
| **16** | [`tests/bug1a_and_1b_fix.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/bug1a_and_1b_fix.test.ts) | **Bug 1a (Dangling Config Reference) & Bug 1b (ownerRole Priority)**<br>**Bug 1a:** deteksi `DANGLING_CONFIG_REFERENCE` dan repair menghasilkan `canEditCurrentTab` multi-role yang resilien. **Bug 1b:** eliminasi pelimpahan tugas salah (`tugasDilimpahkan`) pada `ENTITAS_DATA`, serta kepastian `ownerRole` diisi tepat pada field `terdaftar_oleh` (Simulasi DB = ID pegawai administrasi, bukan Instruktur). | ✅ PASS |
| **17** | [`tests/product_variant_question.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/product_variant_question.test.ts) | **Fitur Baru: Pertanyaan Variasi Produk/Layanan & Nilai Katalog Simulasi DB**<br>Pertanyaan variasi produk di awal alur (**SEBELUM** klarifikasi aktor), append penanda `[Variasi Produk: ...]` ke narasi untuk heuristik Bagian D (3 Lapis), default Tunggal, skip untuk bisnis transaksional jelas (bengkel, warung, laundry kiloan) & operasional internal (CRM), TANPA allowlist domain (studio tato/bimbel/ternak tetap ditanya), serta nilai varian riil user dipakai di tabel katalog Simulasi DB. | ✅ PASS |
| **18** | [`tests/laundry_schema_tabs_and_tailwind_active.test.ts`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/laundry_schema_tabs_and_tailwind_active.test.ts) | **Regresi Role Tab Ampersand & Tailwind v4 Native Variants**<br>Verifikasi penanganan karakter khusus (`&`) pada nama role seperti `Staf Pencuci & Setrika` agar tidak memicu `ROLE_MISSING_TAB_NAVIGATION`, serta memastikan variant modern (`active:scale-95`, `active:bg-blue-700`, dsb) dipertahankan dan lolos validasi tanpa dipangkas regex. | ✅ PASS |

---

## 3. Direktori Fixtures

Seluruh artefak kode HTML lengkap yang digunakan sebagai referensi pengujian disimpan di folder [`tests/fixtures/`](file:///Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/tests/fixtures):
- `tests/fixtures/kursus_menyetir_mobil.html`: Artefak implementasi domain Kursus Mobil (4 roles, 4 parameterized tables).
- `tests/fixtures/sales_prospek_crm.html`: Artefak implementasi domain Sales CRM (3 roles, 3 parameterized tables, GPS, Foto, Approval, Quotation, Funnel, Leaderboard).
- `tests/fixtures/koperasi_simpan_pinjam.html`: Artefak implementasi domain Koperasi Simpan Pinjam (3 roles, 3 parameterized tables, multi-role login, approval pinjaman).

---

## 4. Keputusan Mengenai Pensiunnya Modul / Test Legacy

### 4.1. Pensiunnya Test Suite #1 Lama (`tailwind_v2_whitelist.test.ts`) & Kamus 39k Kelas
1. **Latar Belakang**: Pada implementasi awal Tailwind v2 precompiled (`tailwindcss@2.2.19`), sebuah kamus JSON raksasa berisi 39.062 kelas (`tailwindV2Classes.json`) dan whitelist validator digunakan untuk mencegah kelas v3+/arbitrary values.
2. **Migrasi ke Tailwind v4 Browser Build**: Codebase telah bermigrasi ke `@tailwindcss/browser@4` (JIT in-browser) yang mendukung arbitrary values (`w-[...]`), kalkulasi dinamis, dan variant modern (`active:`, `disabled:`, `focus-visible:`, dsb) secara native dalam lingkungan sandbox iframe tanpa `localStorage`.
3. **Pensiun Resmi**: File `tailwindV2Classes.json` dihapus (~400KB dead weight), dan `tests/tailwind_v2_whitelist.test.ts` resmi dipensiunkan (dead code) digantikan oleh `tests/tailwind_v4_lightweight_validator.test.ts`. Validator baru ini hanya melarang kelas plugin non-core yang memang tidak didukung browser build (`scrollbar-hide`, `@tailwindcss/forms` `form-*`, `@tailwindcss/typography` `prose*`, dsb).

### 4.2. Pensiunnya Legacy Vanilla Tests (Suite 7-10 Lama)
Sesuai Keputusan Arsitektur Besar **FULL REPLACEMENT** (bukan hybrid):
1. Seluruh generator kode baru di `/api/generate/route.ts` 100% menghasilkan aplikasi Vue 3 Options API + Parameterized CRUD.
2. Tidak ada jalur di codebase yang menghasilkan atau memerlukan Vanilla JS AST walker untuk DOM event handlers statis (`onclick="..."` manual pada ratusan fungsi inline).
3. Suite 7-10 lama (`test_step6a_create_branch.mts` s/d `test_step6d_delete_action.mts`) yang menguji regex/AST Vanilla JS lama telah dipensiunkan/dihapus dari test suite aktif karena merupakan *dead code* dan digantikan sepenuhnya oleh `tests/vue_validators_6a_6b_6d.test.ts`.

---

## 5. Catatan: Verifikasi Manual Berbayar (di luar master runner)

`scratch/` berisi skrip verifikasi manual yang **TIDAK** masuk master runner karena memanggil API AI berbayar atau menyentuh lingkungan live. Skrip keluar dengan kode `2` (BLOCKED, bukan gagal palsu) bila API key tidak tersedia.

Contoh yang paling relevan: `scratch/test_langkah9_kuliner_live_pipeline.ts` — membuktikan pipeline end-to-end Pelatihan Kuliner sungguhan dari narasi mentah (tanpa menyebut varian) → sub-step "Ada beberapa varian" → AI `generateDataSchemaWithAI` menghasilkan skema dari nol → assert pola 3 Lapis (katalog + pendaftaran penghubung + turunan) benar-benar terbentuk.
