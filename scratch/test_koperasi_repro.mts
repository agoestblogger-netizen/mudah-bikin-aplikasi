import { getDomainFlowDetails } from '../src/lib/templates/processes/guided.js';
import { generateFallbackRbacMatrix } from '../src/app/api/guided/route.js';
import type { MockupSessionState } from '../src/lib/templates/types.js';

// Simulasi persis sesi Koperasi Simpan Pinjam saat user menggunakan aplikasi
const mockKoperasiSession: MockupSessionState = {
  step: 'ALUR',
  domain: 'Koperasi Simpan Pinjam',
  match: {
    businessCategory: 'Koperasi Simpan Pinjam',
    templateId: 'MT-20',
    tier: 'TIER_1',
    patternIds: ['UP-06', 'UP-09']
  },
  storyline: {
    narasi: 'Koperasi simpan pinjam melayani anggota dalam pengajuan pinjaman dan setoran simpanan sukarela maupun wajib. Petugas operasional dan kasir melayani transaksi harian di loket serta pengurus koperasi memantau persetujuan kredit.',
    asumsiMasalah: 'Pencatatan angsuran dan monitoring kredit macet masih manual',
    asumsiAlurUtama: 'Anggota mengajukan pinjaman -> Petugas Kasir memverifikasi kelayakan berkas -> Pengurus Koperasi menyetujui pinjaman -> Kasir mencairkan dana dan mencetak bukti',
    asumsiAktor: ['Anggota', 'Petugas Kasir', 'Pengurus Koperasi', 'Super Admin']
  },
  roles: {
    selected: ['Super Admin', 'Anggota', 'Petugas Kasir', 'Pengurus Koperasi'],
    wajib: ['Super Admin', 'Petugas Kasir'],
    custom: []
  },
  flow: {
    alurInti: [
      { step: 1, pelaku: 'Anggota', aksi: 'Mengajukan permohonan pinjaman atau setoran simpanan sukarela di loket' },
      { step: 2, pelaku: 'Petugas Kasir', aksi: 'Memverifikasi kelayakan berkas, saldo simpanan, dan menghitung angsuran bulanan' },
      { step: 3, pelaku: 'Pengurus Koperasi', aksi: 'Mengevaluasi kelayakan risiko dan menyetujui plafon pencairan kredit pinjaman' },
      { step: 4, pelaku: 'Petugas Kasir', aksi: 'Mencairkan dana tunai pinjaman dan mencetak bukti kuitansi akad simpan pinjam' }
    ],
    alurPendukung: [
      {
        nama: 'Penanganan Tunggakan Angsuran & Restrukturisasi Kredit',
        steps: [
          { pelaku: 'Anggota', aksi: 'Mengajukan keringanan tenor angsuran' },
          { pelaku: 'Pengurus Koperasi', aksi: 'Menyetujui jadwal amortisasi cicilan baru' }
        ]
      }
    ]
  }
};

console.log('=== REPRODUKSI BUG ALUR PENDUKUNG (FALLBACK OFFLINE) ===');
const flowDetails = getDomainFlowDetails(mockKoperasiSession, { forceFresh: true });
const supportingFlows = flowDetails.alurPendukung;

console.log('Alur Pendukung yang Dihasilkan:');
supportingFlows.forEach((sf) => {
  console.log(`- ID: ${sf.id} | Nama: ${sf.nama}`);
  sf.steps.forEach((s) => console.log(`  * (${s.pelaku}) ${s.aksi}`));
});

console.log('\n=== REPRODUKSI BUG RBAC MATRIX (FALLBACK OFFLINE) ===');
const rbacFallback = generateFallbackRbacMatrix(mockKoperasiSession);
console.log('Modul RBAC Fallback yang Dihasilkan:');
rbacFallback.modul.forEach((m) => {
  console.log(`- Modul: "${m.nama}" | Deskripsi: "${m.deskripsiFungsional}"`);
});
