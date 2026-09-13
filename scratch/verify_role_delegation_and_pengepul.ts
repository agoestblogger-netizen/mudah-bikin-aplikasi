import {
  applyGuidedAnswer,
  getRoleNarrativeAndResponsibilities,
  isExternalRole,
  canonicalRoleKey
} from '../src/lib/templates/processes/guided.js';
import type { MockupSessionState } from '../src/lib/templates/processes/types.js';

console.log('--- Test 1: canonicalRoleKey and isExternalRole ---');
console.log('canonicalRoleKey("Warga"):', canonicalRoleKey('Warga'));
console.log('isExternalRole("Warga"):', isExternalRole('Warga'));
console.log('isExternalRole("Pelanggan"):', isExternalRole('Pelanggan'));
console.log('isExternalRole("Pengepul"):', isExternalRole('Pengepul'));
console.log('isExternalRole("Petugas Gudang"):', isExternalRole('Petugas Gudang'));

if (!isExternalRole('Warga')) {
  throw new Error('FAIL: Warga should be an external role');
}
if (isExternalRole('Pengepul')) {
  throw new Error('FAIL: Pengepul should NOT be an external role');
}

console.log('\n--- Test 2: Pengepul Responsibilities & Narrative ---');
const pengepulDetails = getRoleNarrativeAndResponsibilities(
  'Pengepul',
  'Jual Beli Barang Bekas / Rosok',
  {
    narasi: 'Sistem beli barang rosok keliling dan setor ke gudang pengepul',
    asumsiMasalah: 'Pencatatan timbangan manual',
    asumsiAktor: ['Super Admin', 'Petugas Pembeli', 'Pengepul'],
    asumsiAlurUtama: 'Petugas keliling beli dari warga lalu setor ke pengepul',
    statusKonfirmasi: 'disetujui'
  }
);
console.log('Pengepul Narrative:', pengepulDetails.narasi);
console.log('Pengepul Tasks:', pengepulDetails.tanggungJawab);

if (pengepulDetails.tanggungJawab.some((t: string) => t.includes('Mendatangi lokasi'))) {
  throw new Error('FAIL: Pengepul should NOT have mobile field visit tasks!');
}
if (!pengepulDetails.tanggungJawab.some((t: string) => t.includes('setoran') || t.includes('gudang') || t.includes('penampungan'))) {
  throw new Error('FAIL: Pengepul should have receiving / warehouse tasks!');
}

console.log('\n--- Test 3: Deselecting Warga vs Deselecting Staf Gudang in applyGuidedAnswer ---');
const mockSession: MockupSessionState = {
  step: 'ROLE',
  match: {
    templateId: 'MT-05',
    overlayIds: [],
    patternIds: [],
    tier: 'TIER_1',
    businessCategory: 'Jual Beli Barang Rosok'
  },
  storyline: {
    narasi: 'Layanan jemput barang rosok ke rumah warga',
    asumsiMasalah: 'Timbangan manual',
    asumsiAktor: ['Super Admin', 'Petugas Lapangan', 'Pengepul', 'Warga', 'Gudang'],
    asumsiAlurUtama: 'Petugas mendatangi warga lalu membawa ke gudang',
    statusKonfirmasi: 'disetujui'
  },
  roles: {
    selected: ['Super Admin', 'Petugas Lapangan', 'Pengepul', 'Warga', 'Gudang']
  },
  flow: {}
};

// Simulate user deselecting "Warga" (only keeping Super Admin, Petugas Lapangan, Pengepul, Gudang)
const updatedWithoutWarga = applyGuidedAnswer(
  mockSession,
  'ROLE',
  ['Super Admin', 'Petugas Lapangan', 'Pengepul', 'Gudang']
);

console.log('Removed external roles:', updatedWithoutWarga.roles.removedExternalRoles);
console.log('Tugas dilimpahkan:', updatedWithoutWarga.roles.tugasDilimpahkan);

const wargaDelegated = updatedWithoutWarga.roles.tugasDilimpahkan?.find(
  (d: { dariRole: string }) => d.dariRole.toLowerCase().includes('warga')
);
if (wargaDelegated) {
  throw new Error('FAIL: Warga task was wrongly delegated to Owner!');
}
if (!updatedWithoutWarga.roles.removedExternalRoles?.includes('Warga')) {
  throw new Error('FAIL: Warga should be in removedExternalRoles!');
}

// Simulate user also deselecting "Gudang" (an internal staff role)
const updatedWithoutGudangAndWarga = applyGuidedAnswer(
  mockSession,
  'ROLE',
  ['Super Admin', 'Petugas Lapangan', 'Pengepul']
);

console.log('Without Gudang & Warga - removed external roles:', updatedWithoutGudangAndWarga.roles.removedExternalRoles);
console.log('Without Gudang & Warga - tugas dilimpahkan:', updatedWithoutGudangAndWarga.roles.tugasDilimpahkan);

const gudangDelegated = updatedWithoutGudangAndWarga.roles.tugasDilimpahkan?.find(
  (d: { dariRole: string }) => d.dariRole.toLowerCase().includes('gudang')
);
if (!gudangDelegated) {
  throw new Error('FAIL: Gudang should be delegated to Owner!');
}

console.log('\nALL VERIFICATION TESTS PASSED SUCCESSFULLY! ✅');
