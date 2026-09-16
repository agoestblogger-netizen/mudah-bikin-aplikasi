import { detectTargetRoleSemanticAI } from '../src/app/api/guided/route';

async function testDebug() {
  const roles1 = ['Super Admin', 'Mentor Vokasi', 'Staf Administrasi'];
  const res1 = await detectTargetRoleSemanticAI('pembimbing', 'ID pembimbing praktek kerja', roles1);
  console.log('Final Result 1:', res1);
}

testDebug().catch(console.error);
