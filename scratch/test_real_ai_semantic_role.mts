import { detectTargetRoleSemanticAI } from '../src/app/api/guided/route';

async function testRealAi() {
  console.log('Testing detectTargetRoleSemanticAI with real AI...');
  console.log('GEMINI_API_KEY present:', Boolean(process.env.GEMINI_API_KEY));

  const roles1 = ['Super Admin', 'Mentor Vokasi', 'Staf Administrasi'];
  const res1 = await detectTargetRoleSemanticAI('pembimbing', 'ID pembimbing praktek kerja', roles1);
  console.log('Test 1: "pembimbing" against', roles1, '-> Result:', res1);

  const roles2 = ['Super Admin', 'Pembina Lapangan', 'Staf'];
  const res2 = await detectTargetRoleSemanticAI('pengawas', 'ID pengawas kegiatan lapangan', roles2);
  console.log('Test 2: "pengawas" against', roles2, '-> Result:', res2);

  const roles3 = ['Super Admin', 'Staf Kasir', 'Pelanggan'];
  const res3 = await detectTargetRoleSemanticAI('warna_favorit', 'warna kesukaan', roles3);
  console.log('Test 3: "warna_favorit" against', roles3, '-> Result:', res3);
}

testRealAi().catch((err) => {
  console.error('Error running real AI test:', err);
});
