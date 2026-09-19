import {
  buildGuidedStep,
  applyGuidedAnswer,
  REQUIRED_ROLE
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

function createRentalSepedaSession(): MockupSessionState {
  return {
    step: 'ROLE',
    match: {
      templateId: 'rental_template',
      patternIds: ['SEWA_ASET_DURASI'],
      overlayIds: [],
      tier: 'TIER_1',
      businessCategory: 'Rental Sepeda',
      contextualRoles: ['Super Admin', 'Staf Rental', 'Pelanggan']
    },
    storyline: {
      narasi: 'Pelanggan datang ke counter rental untuk memilih sepeda, staf rental mencatat identitas pelanggan dan menyerahkan unit, lalu setelah pemakaian staf menerima pengembalian.',
      asumsiMasalah: 'Pencatatan unit sepeda dan durasi sewa',
      asumsiAktor: ['Super Admin', 'Staf Rental', 'Pelanggan'],
      asumsiAlurUtama: 'Alur sewa unit sepeda oleh pelanggan',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      detailAktor: {
        'Super Admin': {
          narasi: 'Pemilik rental yang mengawasi seluruh operasional.',
          tanggungJawab: ['Memantau keuangan', 'Melihat laporan sewa']
        },
        'Staf Rental': {
          narasi: 'Petugas counter yang mencatat pendaftaran sewa dan penyerahan sepeda.',
          tanggungJawab: ['Mencatat transaksi sewa', 'Memeriksa kondisi sepeda']
        },
        'Pelanggan': {
          narasi: 'Penyewa sepeda yang datang ke lokasi untuk menggunakan sepeda.',
          tanggungJawab: ['Memilih sepeda', 'Membayar sewa']
        }
      }
    },
    actorsClassification: [
      {
        actor: 'Super Admin',
        category: 'PENGGUNA_SISTEM',
        reason: 'Pemilik usaha pemegang kendali'
      },
      {
        actor: 'Staf Rental',
        category: 'PENGGUNA_SISTEM',
        reason: 'Staf operasional yang mengoperasikan sistem'
      },
      {
        actor: 'Pelanggan',
        category: 'ENTITAS_DATA',
        ownerRole: 'Staf Rental',
        reason: 'Entitas data yang dicatat dan dilayani staf rental di counter'
      }
    ],
    features: { selected: [] },
    roles: { selected: [REQUIRED_ROLE], wajib: [REQUIRED_ROLE], tambahan: [] }
  };
}

function createKursusMusikSession(): MockupSessionState {
  return {
    step: 'ROLE',
    match: {
      templateId: 'kursus_template',
      patternIds: ['KURSUS_PENDIDIKAN'],
      overlayIds: [],
      tier: 'TIER_2',
      businessCategory: 'Kursus Musik',
      contextualRoles: ['Super Admin', 'Instruktur Musik', 'Siswa']
    },
    storyline: {
      narasi: 'Siswa mendaftar kursus musik, staf administrasi mencatat profil siswa, dan instruktur musik mengajar serta menilai kemajuan siswa.',
      asumsiMasalah: 'Manajemen siswa kursus dan instruktur',
      asumsiAktor: ['Super Admin', 'Instruktur Musik', 'Siswa'],
      asumsiAlurUtama: 'Pendaftaran siswa dan pelaksanaan les kursus musik',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      detailAktor: {
        'Super Admin': {
          narasi: 'Pemilik lembaga kursus.',
          tanggungJawab: ['Mengelola seluruh operasional kursus']
        },
        'Instruktur Musik': {
          narasi: 'Pengajar kelas musik.',
          tanggungJawab: ['Mengisi jadwal dan materi les']
        },
        'Siswa': {
          narasi: 'Peserta didik kursus musik.',
          tanggungJawab: ['Mengikuti kelas dan latihan']
        }
      }
    },
    actorsClassification: [
      {
        actor: 'Super Admin',
        category: 'PENGGUNA_SISTEM',
        reason: 'Pemilik'
      },
      {
        actor: 'Instruktur Musik',
        category: 'PENGGUNA_SISTEM',
        reason: 'Pengajar operasional'
      },
      {
        actor: 'Siswa',
        category: 'ENTITAS_DATA',
        ownerRole: 'Instruktur Musik',
        reason: 'Entitas data siswa yang dicatat lembaga'
      }
    ],
    features: { selected: [] },
    roles: { selected: [REQUIRED_ROLE], wajib: [REQUIRED_ROLE], tambahan: [] }
  };
}

async function runTests() {
  console.log('=== TEST 1: Rental Sepeda - Section Terpisah Entitas Data di Step ROLE ===');
  const rentalSession = createRentalSepedaSession();
  const rentalStep = buildGuidedStep(rentalSession)!;

  const roleOptionIds = rentalStep.options.map((o) => o.id);
  console.log('Daftar Peran Login (options):', roleOptionIds);
  console.log('Daftar Entitas Data (entityDataList):', rentalStep.entityDataList);

  if (roleOptionIds.includes('Pelanggan')) {
    throw new Error('FAIL: Pelanggan tidak boleh masuk ke options peran login!');
  }
  if (!rentalStep.entityDataList || rentalStep.entityDataList.length === 0) {
    throw new Error('FAIL: entityDataList kosong!');
  }
  const pelangganEntity = rentalStep.entityDataList.find((e) => e.name === 'Pelanggan');
  if (!pelangganEntity) {
    throw new Error('FAIL: Pelanggan tidak ditemukan di entityDataList!');
  }
  console.log('Detail Pelanggan di entityDataList:', pelangganEntity);
  console.log('✅ TEST 1 PASS\n');

  console.log('=== TEST 2: Rental Sepeda - Promosi Pelanggan Jadi Peran Login ===');
  // Simulasi user mempromosikan Pelanggan: Pelanggan masuk ke selected
  const updatedRental = applyGuidedAnswer(
    rentalSession,
    'ROLE',
    ['Super Admin', 'Staf Rental', 'Pelanggan'],
    undefined
  );

  console.log('Peran Terpilih (roles.selected):', updatedRental.roles.selected);
  const pelangganClassification = updatedRental.actorsClassification?.find(
    (a) => a.actor.toLowerCase() === 'pelanggan'
  );
  console.log('Klasifikasi Pelanggan setelah promosi:', pelangganClassification);

  if (!updatedRental.roles.selected.includes('Pelanggan')) {
    throw new Error('FAIL: Pelanggan harus ada di roles.selected setelah dipromosikan!');
  }
  if (pelangganClassification?.category !== 'PENGGUNA_SISTEM') {
    throw new Error('FAIL: Kategori Pelanggan di actorsClassification harus PENGGUNA_SISTEM!');
  }
  if (pelangganClassification?.ownerRole) {
    throw new Error('FAIL: ownerRole Pelanggan harus dihapus karena sudah jadi peran login mandiri!');
  }
  console.log('✅ TEST 2 PASS\n');

  console.log('=== TEST 3: Kursus Musik - Generalisasi Section Entitas Data (Siswa) ===');
  const musikSession = createKursusMusikSession();
  const musikStep = buildGuidedStep(musikSession)!;

  const musikRoleIds = musikStep.options.map((o) => o.id);
  console.log('Daftar Peran Login Musik:', musikRoleIds);
  console.log('Daftar Entitas Data Musik:', musikStep.entityDataList);

  if (musikRoleIds.includes('Siswa')) {
    throw new Error('FAIL: Siswa tidak boleh masuk ke options peran login!');
  }
  const siswaEntity = musikStep.entityDataList?.find((e) => e.name === 'Siswa');
  if (!siswaEntity) {
    throw new Error('FAIL: Siswa tidak ditemukan di entityDataList!');
  }
  console.log('Detail Siswa di entityDataList:', siswaEntity);
  console.log('✅ TEST 3 PASS\n');

  console.log('=== TEST 4: Kursus Musik - Promosi Siswa Jadi Peran Login ===');
  const updatedMusik = applyGuidedAnswer(
    musikSession,
    'ROLE',
    ['Super Admin', 'Instruktur Musik', 'Siswa'],
    undefined
  );

  console.log('Peran Terpilih Musik (roles.selected):', updatedMusik.roles.selected);
  const siswaClassification = updatedMusik.actorsClassification?.find(
    (a) => a.actor.toLowerCase() === 'siswa'
  );
  console.log('Klasifikasi Siswa setelah promosi:', siswaClassification);

  if (!updatedMusik.roles.selected.includes('Siswa')) {
    throw new Error('FAIL: Siswa harus ada di roles.selected setelah dipromosikan!');
  }
  if (siswaClassification?.category !== 'PENGGUNA_SISTEM') {
    throw new Error('FAIL: Kategori Siswa harus PENGGUNA_SISTEM!');
  }
  console.log('✅ TEST 4 PASS\n');

  console.log('🎉 ALL 4 TESTS PASSED PERFECTLY!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
