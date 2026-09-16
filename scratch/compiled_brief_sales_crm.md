📋 **Brief Kebutuhan**
- **Nama App**: Aplikasi Sales Prospek CRM untuk trackin
- **Gambaran Proses Bisnis**: Berikut adalah flow proses bisnis dari Sales Prospek CRM untuk tracking prospek leads, pencatatan kunjungan sales di lokasi klien dengan validasi koordinat GPS dan upload foto bukti, negosiasi penawaran deal dengan approval diskon khusus dari Sales Manager, cetak surat quotation resmi, visualisasi pipeline funnel, dan leaderboard performa omzet tim sales. Pelanggan menyampaikan pesanan atau kebutuhan layanan, petugas operasional memproses pekerjaan dengan teliti, kemudian pembayaran diselesaikan di kasir dengan tanda terima yang rapi agar pemilik usaha dapat memantau rekapan secara berkala.
- **Masalah Utama**: Pencatatan antrean dan alur kerja di Aplikasi Sales Prospek CRM untuk trackin membutuhkan koordinasi yang rapi agar tidak ada yang terlewat.
- **Alur Utama (Storyline)**: Pelanggan memesan -> Petugas memproses di lokasi -> Pembayaran tercatat -> Pemilik melihat rekap
- **Orientasi UI**: Responsif, mobile-friendly
- **Tier Aplikasi**: ADVANCE
- **Alur Inti (Aktivitas Utama)**:
  1. *(Klien / Prospek)* Memesan
  2. *(Super Admin)* Memproses di lokasi
  3. *(Super Admin)* Pembayaran tercatat
  4. *(Super Admin)* Melihat rekap
- **Alur Pendukung**:
  * **Koreksi Cetak Ulang Cepat jika Warna Luntur atau Format Rusak**:
    1. *(Klien / Prospek)* Menyampaikan permohonan penanganan seputar kendala Pencatatan antrean dan alur kerja di Aplikasi Sales Prospek CRM untuk trackin membutuhkan koordinasi yang rapi agar tidak ada yang terlewat. dan menyerahkan bukti transaksi terkait
    2. *(Super Admin)* Memeriksa riwayat data hasil cetakan & banner, memvalidasi keabsahan dokumen fisik di sistem, dan merumuskan solusi penanganan
  * **Pembersihan Nozzle Head Mesin Cetak & Restock Gulungan Banner**:
    1. *(Super Admin)* Memeriksa volume tinta warna cair di tangki mesin dan mendata sisa roll vinyl serta stiker cetak
    2. *(Super Admin)* Menyetujui pembelian tinta industri beresolusi tinggi dan memesan bahan baku banner
- **Fitur Pendukung (MVP)**:
  1. Dasbor pemantauan antrean transaksi dan status proses Aplikasi Sales Prospek CRM untuk trackin secara real-time
  2. Buku besar pencatatan riwayat transaksi, mutasi berkas, dan kartu catatan Aplikasi Sales Prospek CRM untuk trackin
  3. Cetak lembar bukti transaksi resmi, kuitansi, invoice, dan dokumen berita acara Aplikasi Sales Prospek CRM untuk trackin (PDF)
  4. Notifikasi WhatsApp otomatis pengingat jadwal, jatuh tempo, atau pembaruan status pengerjaan Aplikasi Sales Prospek CRM untuk trackin
  5. Rekapitulasi performa harian, ringkasan saldo keuangan/omzet, dan ekspor laporan berkala Aplikasi Sales Prospek CRM untuk trackin
- **Ringkasan Role & Status Wewenang**:
  - **Role Wajib**: Super Admin, Staf Kasir
  - **Role Tambahan**: Sales Manager, Sales Executive, Klien / Prospek
  - **Pelimpahan Tugas Role**:
    * Dari Staf Kasir ke Super Admin: Melaksanakan dan mencatat aktivitas operasional terkait Staf Kasir di Aplikasi Sales Prospek CRM untuk trackin; Memverifikasi dan memproses transaksi atau kebutuhan kerja yang masuk; Berkoordinasi dengan tim dan melaporkan rekapitulasi kerja harian ke Pemilik usaha
- **Matriks Hak Akses (RBAC) per Modul Fungsional**:
| Modul Fungsional | Super Admin | Sales Manager | Sales Executive | Klien / Prospek |
| :--- | :--- | :--- | :--- | :--- |
| **Portal Mandiri & Pengajuan Layanan (Klien / Prospek)** | Supervisi & Otorisasi Pengajuan | Verifikasi & Validasi Berkas | Verifikasi & Validasi Berkas | Buat & Pantau (Milik Sendiri) |
| **Pemrosesan Operasional & Verifikasi Berkas** | Supervisi Mutu & Kontrol Operasional | Eksekusi & Validasi Operasional | Eksekusi & Validasi Operasional | Lihat Status Pengerjaan (Milik Sendiri) |
| **Transaksi Pembayaran & Pembukuan Kasir** | Audit Keuangan & Rekonsiliasi Saldo | Input Transaksi & Cetak Struk | Input Transaksi & Cetak Struk | Lihat Tagihan & Bukti Bayar Pribadi |
| **Penanganan Kendala & Audit Kepatuhan Operasional** | Otorisasi Solusi & Evaluasi Audit | Pemeriksaan Berkas & Penanganan Teknis | Pemeriksaan Berkas & Penanganan Teknis | Kirim Masukan / Lapor Kendala (Milik Sendiri) |
| **Manajemen Sistem, Master Data & Hak Akses** | Kontrol Penuh & Pengaturan Sistem | - | - | - |

> 📋 **Keterangan Modul Fungsional:**
> - **Portal Mandiri & Pengajuan Layanan (Klien / Prospek)**: Portal mandiri untuk klien / prospek dalam membuat pengajuan, mengunggah berkas, dan memantau status
> - **Pemrosesan Operasional & Verifikasi Berkas**: Pencatatan verifikasi data, validasi operasional harian, dan pelaksanaan teknis layanan
> - **Transaksi Pembayaran & Pembukuan Kasir**: Penerimaan pembayaran, pencatatan transaksi keuangan, dan penerbitan bukti kuitansi resmi
> - **Penanganan Kendala & Audit Kepatuhan Operasional**: Pencatatan kendala layanan, tindak lanjut penyesuaian transaksi, dan audit kepatuhan harian
> - **Manajemen Sistem, Master Data & Hak Akses**: Pengaturan katalog harga, data master, akun pengguna, dan log audit

> ℹ️ **Catatan Wewenang & Pelimpahan Tugas:**
> - Wewenang operasional "Staf Kasir" dialihkan sepenuhnya ke "Super Admin" karena perampingan organisasi (Melaksanakan dan mencatat aktivitas operasional terkait Staf Kasir di Aplikasi Sales Prospek CRM untuk trackin, Memverifikasi dan memproses transaksi atau kebutuhan kerja yang masuk, Berkoordinasi dengan tim dan melaporkan rekapitulasi kerja harian ke Pemilik usaha).
- **Skema Tabel & Relasi Data**:
### 📦 Tabel: `pengguna`
*Menyimpan akun pengguna, kredensial, dan peran wewenang aktif di sistem*

| Field | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | text | Identitas unik pengguna |
| `nama_lengkap` | text | Nama lengkap pengguna atau staf |
| `role` | text | Peran pengguna (Super Admin / Sales Manager / Sales Executive / Klien / Prospek) |
| `kontak` | text | Nomor WhatsApp atau alamat email aktif |
| `status_aktif` | text | Status keaktifan akun (Aktif / Nonaktif) |

### 📦 Tabel: `portal_mandiri_pengajuan_layanan_klien_prospek`
*Mencatat data transaksi permohonan atau pemesanan utama dari pengguna*

| Field | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | text | Kode transaksi unik |
| `klien_/_prospek_id` | relasi ke pengguna | ID akun pihak pemohon / pelanggan |
| `tanggal_pengajuan` | tanggal | Waktu permohonan atau pemesanan dibuat |
| `rincian_kebutuhan` | text | Deskripsi permohonan, item, atau layanan yang diminta |
| `status_transaksi` | text | Status proses (Menunggu Verifikasi / Diproses / Selesai / Dibatalkan) |
| `diverifikasi_oleh` | relasi ke pengguna | ID atau nama Sales Manager yang memproses data |

### 📦 Tabel: `pemrosesan_operasional_verifikasi_berkas`
*Mencatat pelaksanaan operasional teknis, pemeriksaan berkas, dan pengerjaan lapangan*

| Field | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | text | Identitas unik lembar pengerjaan |
| `portal_mandiri_pengajuan_layanan_klien_prospek_id` | relasi ke portal_mandiri_pengajuan_layanan_klien_prospek | Referensi ke transaksi permohonan terkait |
| `tanggal_pelaksanaan` | tanggal | Waktu eksekusi atau verifikasi dilakukan |
| `catatan_pemeriksaan` | text | Hasil observasi, kelayakan fisik, atau status kelengkapan |
| `petugas_eksekusi` | relasi ke pengguna | ID atau nama Sales Manager yang memproses data |

### 📦 Tabel: `penanganan_kendala`
*Mencatat riwayat kendala operasional, komplain layanan, atau jadwal pemeliharaan pendukung*

| Field | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | text | Nomor tiket kendala unik |
| `portal_mandiri_pengajuan_layanan_klien_prospek_id` | relasi ke portal_mandiri_pengajuan_layanan_klien_prospek | Referensi ke transaksi terkait (bila ada) |
| `tanggal_laporan` | tanggal | Waktu kendala atau jadwal servis dicatat |
| `deskripsi_kendala` | text | Rincian kendala teknis atau permohonan penyesuaian |
| `tindakan_solusi` | text | Langkah penyelesaian yang disetujui atau dieksekusi |
| `ditangani_oleh` | relasi ke pengguna | ID atau nama Sales Manager yang memproses data |

> 🔗 **Korelasi Antar-Tabel:**
> Setiap transaksi baru tercatat di tabel `portal_mandiri_pengajuan_layanan_klien_prospek` dengan menghubungkan akun `pengguna`. Staf operasional menindaklanjuti proses melalui tabel `pemrosesan_operasional_verifikasi_berkas` untuk verifikasi dan pencatatan hasil kerja harian. Bila ditemukan kendala operasional atau jadwal pemeliharaan, tiket dicatat pada tabel `penanganan_kendala` untuk ditindaklanjuti hingga tuntas.
- **Simulasi Database & Akun Demo**:
> 💡 *Catatan: Data yang muncul di prototipe nanti masih berupa data contoh, bukan data asli — Anda dapat mengubah atau menggantinya kapan saja nanti.*

### 📋 Contoh Data Awal: `pengguna`
*Menyimpan akun pengguna, kredensial, dan peran wewenang aktif di sistem*

| `id` | `nama_lengkap` | `role` | `kontak` | `status_aktif` |
| :--- | :--- | :--- | :--- | :--- |
| ID-001 | Pak Bambang (Pemilik) | Super Admin | Aktif | Aktif |
| ID-002 | Akun Demo Sales Manager | Sales Manager | Nonaktif | Nonaktif |
| ID-003 | Akun Demo Sales Executive | Sales Executive | Aktif | Aktif |
| ID-004 | Akun Demo Klien / Prospek | Klien / Prospek | Aktif | Nonaktif |

### 📋 Contoh Data Awal: `portal_mandiri_pengajuan_layanan_klien_prospek`
*Mencatat data transaksi permohonan atau pemesanan utama dari pengguna*

| `id` | `klien_/_prospek_id` | `tanggal_pengajuan` | `rincian_kebutuhan` | `status_transaksi` | `diverifikasi_oleh` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| IDp-001 | ID-004 | 2026-09-10 | Deskripsi permohonan | Menunggu verifikasi | ID-002 |
| IDp-002 | ID-004 | 2026-09-11 | Item | Diproses | ID-002 |
| IDp-003 | ID-004 | 2026-09-12 | Deskripsi permohonan | Selesai | ID-002 |

> 🔗 **Korelasi Antar-Tabel:** `klien_/_prospek_id → pengguna.id` · `diverifikasi_oleh → pengguna.id`

### 📋 Contoh Data Awal: `pemrosesan_operasional_verifikasi_berkas`
*Mencatat pelaksanaan operasional teknis, pemeriksaan berkas, dan pengerjaan lapangan*

| `id` | `portal_mandiri_pengajuan_layanan_klien_prospek_id` | `tanggal_pelaksanaan` | `catatan_pemeriksaan` | `petugas_eksekusi` |
| :--- | :--- | :--- | :--- | :--- |
| IDe-001 | IDp-001 | 2026-09-10 | Hasil observasi | ID-002 |
| IDe-002 | IDp-002 | 2026-09-11 | Kelayakan fisik | ID-002 |
| IDe-003 | IDp-003 | 2026-09-12 | Atau status kelengkapan | ID-002 |

> 🔗 **Korelasi Antar-Tabel:** `portal_mandiri_pengajuan_layanan_klien_prospek_id → portal_mandiri_pengajuan_layanan_klien_prospek.id` · `petugas_eksekusi → pengguna.id`

### 📋 Contoh Data Awal: `penanganan_kendala`
*Mencatat riwayat kendala operasional, komplain layanan, atau jadwal pemeliharaan pendukung*

| `id` | `portal_mandiri_pengajuan_layanan_klien_prospek_id` | `tanggal_laporan` | `deskripsi_kendala` | `tindakan_solusi` | `ditangani_oleh` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| IDn-001 | IDp-001 | 2026-09-10 | Kondisi baik & lengkap | Langkah A | ID-002 |
| IDn-002 | IDp-002 | 2026-09-11 | Perlu penanganan lanjutan | Langkah B | ID-002 |
| IDn-003 | IDp-003 | 2026-09-12 | Selesai tepat waktu | Langkah C | ID-002 |

> 🔗 **Korelasi Antar-Tabel:** `portal_mandiri_pengajuan_layanan_klien_prospek_id → portal_mandiri_pengajuan_layanan_klien_prospek.id` · `ditangani_oleh → pengguna.id`

### 🔑 Akun Demo untuk Uji Coba Login
| Nama Akun | Role | Username | Password |
| :--- | :--- | :--- | :--- |
| Pak Bambang (Pemilik) | **Super Admin** | `superadmin` | `superadmin123` |
| Akun Demo Sales Manager | **Sales Manager** | `salesmanager` | `salesmanager123` |
| Akun Demo Sales Executive | **Sales Executive** | `salesexecutive` | `salesexecutive123` |
| Akun Demo Klien / Prospek | **Klien / Prospek** | `klienprospek` | `klienprospek123` |
- **Instruksi Internal Generator Prototipe**:
  1. Simpan tiap tabel dari session.dataSchema sebagai state di memori (React state atau array biasa saat generate kode nanti) — BUKAN localStorage/sessionStorage.
  2. Isi 3-5 baris data dummy per tabel dengan relasi yang VALID — field bertipe "relasi ke [Entitas]" harus benar-benar merujuk ke ID yang ada di tabel entitas tersebut, bukan angka acak.
  3. Akses data lewat fungsi terpisah per tabel (tambahTransaksi(), ambilProdukById(), dst) — bukan manipulasi array langsung tersebar di banyak tempat kode.
  4. Simulasikan relasi antar tabel secara manual di kode (pencarian berdasarkan id) — konsisten dengan cara kerja backend Google Sheets nanti yang tidak punya JOIN otomatis.
  5. Terapkan RBAC sejak prototipe menggunakan akun dummy di atas — role yang tidak punya akses ke suatu modul (sesuai matriks RBAC dari POIN 5) tidak boleh melihat data/fitur modul itu di prototipe.
- **Job Description & Struktur Halaman per Role**:
  * **Super Admin**:
    - Manajemen Sistem (default): section Akun Staf, section Role & Permission, section Audit Log
      * Field Input:
        - [x] Nama / Email Staf (Text)
        - [x] Role dan Permission (Select)
      * Action / Event:
        - [x] onclick: Tambah Akun Staf (Membuat akun staf baru)
        - [x] onclick: Atur Role & Permission (Mengubah hak akses staf)
  * **Sales Manager**:
    - Dashboard & Laporan (default): section Rekapitulasi performa harian, ringkasan saldo keuangan/omzet, dan ekspor laporan berkala Aplikasi Sales Prospek CRM untuk trackin
      * Field Input:
        - [x] Id (text)
        - [x] Klien / Prospek Id (relasi ke pengguna)
        - [x] Tanggal Pengajuan (tanggal)
      * Action / Event:
        - [x] onclick: Simpan Data portal mandiri pengajuan layanan klien prospek (Memproses data di tabel portal_mandiri_pengajuan_layanan_klien_prospek)
  * **Sales Executive**:
    - Operasional Sales Executive (default): section Dasbor pemantauan antrean transaksi dan status proses Aplikasi Sales Prospek CRM untuk trackin secara real-time, section Buku besar pencatatan riwayat transaksi, mutasi berkas, dan kartu catatan Aplikasi Sales Prospek CRM untuk trackin, section Cetak lembar bukti transaksi resmi, kuitansi, invoice, dan dokumen berita acara Aplikasi Sales Prospek CRM untuk trackin (PDF), section Notifikasi WhatsApp otomatis pengingat jadwal, jatuh tempo, atau pembaruan status pengerjaan Aplikasi Sales Prospek CRM untuk trackin
      * Field Input:
        - [x] Id (text)
        - [x] Klien / Prospek Id (relasi ke pengguna)
        - [x] Tanggal Pengajuan (tanggal)
      * Action / Event:
        - [x] onclick: Simpan Data portal mandiri pengajuan layanan klien prospek (Memproses data di tabel portal_mandiri_pengajuan_layanan_klien_prospek)
  * **Klien / Prospek**:
    - Operasional Klien / Prospek (default): section Memesan, section Menyampaikan permohonan penanganan seputar kendala Pencatatan antrean dan alur kerja di Aplikasi Sales Prospek CRM untuk trackin membutuhkan koordinasi yang rapi agar tidak ada yang terlewat. dan menyerahkan bukti transaksi terkait
      * Field Input:
        - [x] Id (text)
        - [x] Klien / Prospek Id (relasi ke pengguna)
        - [x] Tanggal Pengajuan (tanggal)
      * Action / Event:
        - [x] onclick: Memesan (Memproses data di tabel portal_mandiri_pengajuan_layanan_klien_prospek)