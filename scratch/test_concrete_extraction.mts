import type { MockupSessionState, SupportingFlowItem, SupportingFeatureItem } from '../src/lib/templates/types.js';

/**
 * Ekstraktor detail konkret dari narasi, alur inti, dan masalah tanpa profil industri statik.
 * Menggali frasa benda nyata (noun phrases) dan kata kerja operasional nyata.
 */
export function generateConcreteSupportingFlows(
  session: MockupSessionState,
  activeCore: string,
  activeOwner: string,
  findActor: (pattern: RegExp, defaultName: string) => string
): SupportingFlowItem[] {
  const narrative = (session.storyline?.narasi || '').trim();
  const mainFlow = (session.storyline?.asumsiAlurUtama || '').trim();
  const problem = (session.storyline?.asumsiMasalah || '').trim();
  const domain = ((session as any).domain || session.match?.businessCategory || 'Operasional').trim();

  const customerActor = findActor(
    /pelanggan|penyewa|pasien|pembeli|klien|tamu|member|warga|siswa|murid|anggota|nasabah/i,
    'Pelanggan'
  );

  const governanceActor = session.roles?.selected?.find((r) =>
    /pengurus|komite|direktur|manajer|pimpinan|kepala|supervisor|analis|surveyor/i.test(r) && r !== activeOwner
  );
  const reviewerActor = governanceActor || activeOwner;

  // 1. EKSTRAKSI DETAIL MASALAH OPERASIONAL KONKRET (Untuk Alur Pendukung 1)
  // Bersihkan filler dari asumsiMasalah
  let cleanProblem = problem
    .replace(/^(masalah|kendala|permasalahan|isu|kesulitan)\s*(utama|operasional)?\s*[:=-]?\s*/i, '')
    .replace(/\b(masih\s+manual|sering\s+terjadi|sulit\s+dipantau|tidak\s+tercatat|kurang\s+efisien|kurang\s+terkoordinasi|menumpuk|sering\s+komplain)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Ekstrak objek masalah konkret
  const problemKeywords: string[] = [];
  if (/\b(kredit\s*macet|tunggakan|angsuran|cicilan|gagal\s*bayar)\b/i.test(cleanProblem + ' ' + narrative)) {
    problemKeywords.push('Tunggakan Angsuran & Penyesuaian Plafon Pinjaman');
  } else if (/\b(kerusakan|rusak|cacat|lecet|hilang|denda|terlambat)\b/i.test(cleanProblem + ' ' + narrative)) {
    problemKeywords.push('Klaim Kerusakan Fisik & Perhitungan Denda Keterlambatan');
  } else if (/\b(alergi|sakit|demam|tertukar|vaksin|karantina)\b/i.test(cleanProblem + ' ' + narrative)) {
    problemKeywords.push('Penanganan Hewan Sakit & Penyesuaian Pakan Khusus');
  } else if (/\b(salah\s*model|potongan|rambut|kurang\s*rapi|warna\s*luntur)\b/i.test(cleanProblem + ' ' + narrative)) {
    problemKeywords.push('Koreksi Hasil Pengerjaan & Perapian Ulang');
  } else if (/\b(pesanan\s*salah|batal|retur|kembali\s*barang)\b/i.test(cleanProblem + ' ' + narrative)) {
    problemKeywords.push('Penanganan Retur Pesanan & Pengembalian Dana');
  }

  // Objek spesifik dari alur inti (misal: "angsuran", "pinjaman", "bodi armada", "pakan", "hasil cetak")
  const mainFlowTokens = mainFlow.toLowerCase();
  let specificFocal = 'Layanan';
  if (/pinjaman|simpanan|kredit/i.test(mainFlowTokens)) specificFocal = 'Pinjaman & Simpanan';
  else if (/armada|mobil|kendaraan|kunci/i.test(mainFlowTokens)) specificFocal = 'Unit Kendaraan';
  else if (/kucing|anjing|hewan|kandang/i.test(mainFlowTokens)) specificFocal = 'Kandang & Perawatan Anabul';
  else if (/rambut|cukur|potong/i.test(mainFlowTokens)) specificFocal = 'Potongan Rambut';
  else if (/cetak|banner|sablon/i.test(mainFlowTokens)) specificFocal = 'Hasil Cetakan';

  // Objek audit/sarana dari langkah akhir (misal: kasir, kuitansi, berkas, alat)
  let saranaAudit = 'Rekonsiliasi Kas Harian & Audit Berkas Transaksi';
  if (/brankas|kasir|kuitansi|akad|mutasi/i.test(mainFlowTokens)) {
    saranaAudit = 'Audit Fisik Brankas Kasir & Rekonsiliasi Kuitansi Akad';
  } else if (/odometer|stnk|oli|mesin|bodi/i.test(mainFlowTokens)) {
    saranaAudit = 'Pemeriksaan Masa Berlaku STNK & Jadwal Servis Armada';
  } else if (/clipper|silet|pomade|handuk/i.test(mainFlowTokens)) {
    saranaAudit = 'Sterilisasi Pisau Clipper & Restock Bahan Perawatan';
  } else if (/kaporit|pompa|filter|air/i.test(mainFlowTokens)) {
    saranaAudit = 'Uji Kejernihan Air Kolam & Perawatan Mesin Filter';
  } else if (/tinta|head|roll|vinyl/i.test(mainFlowTokens)) {
    saranaAudit = 'Pembersihan Head Mesin Cetak & Restock Gulungan Bahan';
  }

  const title1 = problemKeywords[0] || `Penanganan Kendala Spesifik & Pembatalan Transaksi ${domain}`;

  return [
    {
      id: 'alur_kendala_operasional',
      nama: title1,
      steps: [
        {
          pelaku: customerActor,
          aksi: `Menyampaikan laporan kendala seputar ${cleanProblem || specificFocal} dan menyerahkan bukti dokumen terkait`
        },
        {
          pelaku: activeCore,
          aksi: `Memeriksa histori transaksi ${specificFocal}, memvalidasi keabsahan data fisik di sistem, dan menyiapkan opsi penanganan`
        },
        ...(governanceActor
          ? [
              {
                pelaku: reviewerActor,
                aksi: `Mengevaluasi laporan penanganan ${cleanProblem || specificFocal} dan mengotorisasi keputusan persetujuan adendum`
              }
            ]
          : [])
      ]
    },
    {
      id: 'alur_audit_sarana',
      nama: saranaAudit,
      steps: [
        {
          pelaku: activeCore,
          aksi: `Mendata bukti fisik transaksi harian, mencocokkan rekonsiliasi catatan operasional, dan memeriksa kelayakan instrumen pendukung`
        },
        {
          pelaku: activeOwner,
          aksi: `Memeriksa laporan rekonsiliasi berkala, mengotorisasi pengeluaran kas penunjang, dan menyetujui evaluasi kepatuhan tata kelola`
        }
      ]
    }
  ];
}
