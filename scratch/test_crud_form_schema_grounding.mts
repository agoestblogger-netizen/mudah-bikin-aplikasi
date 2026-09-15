/**
 * Unit Test: Bug A & B — CRUD Form Schema Grounding & Relasi Dropdown
 */

import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator.js';

const htmlWithRelasiTextInput = `<!DOCTYPE html><html><head><title>Test</title></head><body>
<div id="loginScreen" style="display:flex;"><div>
  <input type="text" id="loginUsername" placeholder="Username">
  <input type="password" id="loginPassword" placeholder="Password">
  <button onclick="handleLogin()">Masuk</button>
</div></div>
<div id="appContainer" style="display:none;">
  <div class="tab-nav">
    <button class="tab-btn" data-access-roles="Instruktur Musik" onclick="showTab('tab-evaluasi')">📋 Evaluasi</button>
    <button class="tab-btn" data-access-roles="Super Admin" onclick="showTab('tab-admin')">⚙️ Admin</button>
  </div>
  <div id="tab-evaluasi" class="tab-content">
    <input type="text" id="inputSiswaId" placeholder="ID Siswa">
    <input type="text" id="inputJadwalId" placeholder="Pilih Jadwal">
    <button onclick="simpanEvaluasi()">Simpan</button>
  </div>
  <div id="tab-admin" class="tab-content"><h2>Admin</h2></div>
</div>
<script>
var DEMO_ACCOUNTS = [
  { role: 'Instruktur Musik', username: 'instrukturmusik', password: 'instrukturmusik123', landingTab: 'tab-evaluasi' },
  { role: 'Super Admin', username: 'superadmin', password: 'superadmin123', landingTab: 'tab-admin' }
];
window.DEMO_ACCOUNTS = DEMO_ACCOUNTS;
var OWNER_ROLE_NAME = 'Super Admin'; window.OWNER_ROLE_NAME = OWNER_ROLE_NAME;
var currentRole = '';
function showTab(id) { document.querySelectorAll('.tab-content').forEach(t => { t.style.display='none'; t.classList.remove('active'); }); const t=document.getElementById(id); if(t){t.style.display='block';t.classList.add('active');} }
function filterTabsByRole(role) { document.querySelectorAll('.tab-btn').forEach(btn => { const allowed=(btn.getAttribute('data-access-roles')||'').split(',').map(r=>r.trim().toLowerCase()); const isOwner=role&&role.toLowerCase()===OWNER_ROLE_NAME.toLowerCase(); btn.style.display=(isOwner||allowed.includes(role.toLowerCase()))?'':'none'; }); }
function loginAs(role) { currentRole=role; document.getElementById('loginScreen').style.display='none'; document.getElementById('appContainer').style.display='block'; filterTabsByRole(role); const matched=DEMO_ACCOUNTS.find(a=>a.role===role); if(matched&&matched.landingTab)showTab(matched.landingTab); }
function handleLogin() { const u=document.getElementById('loginUsername').value.trim().toLowerCase(); const p=document.getElementById('loginPassword').value.trim(); const acc=DEMO_ACCOUNTS.find(a=>a.username===u&&a.password===p); if(acc)loginAs(acc.role); }
function simpanEvaluasi() {}
</script></body></html>`;

const htmlWithRelasiSelectFixed = `<!DOCTYPE html><html><head><title>Test Fixed</title></head><body>
<div id="loginScreen" style="display:flex;"><div>
  <input type="text" id="loginUsername" placeholder="Username">
  <input type="password" id="loginPassword" placeholder="Password">
  <button onclick="handleLogin()">Masuk</button>
</div></div>
<div id="appContainer" style="display:none;">
  <div class="tab-nav">
    <button class="tab-btn" data-access-roles="Instruktur Musik" onclick="showTab('tab-evaluasi')">📋 Evaluasi</button>
    <button class="tab-btn" data-access-roles="Super Admin" onclick="showTab('tab-admin')">⚙️ Admin</button>
  </div>
  <div id="tab-evaluasi" class="tab-content">
    <select id="inputSiswaId"><option value="">-- Pilih Siswa --</option><option value="s001">Ahmad Fauzi</option></select>
    <select id="inputJadwalId"><option value="">-- Pilih Jadwal --</option><option value="j001">Senin 09:00</option></select>
    <button onclick="simpanEvaluasi()">Simpan</button>
  </div>
  <div id="tab-admin" class="tab-content"><h2>Admin</h2></div>
</div>
<script>
var DEMO_ACCOUNTS = [
  { role: 'Instruktur Musik', username: 'instrukturmusik', password: 'instrukturmusik123', landingTab: 'tab-evaluasi' },
  { role: 'Super Admin', username: 'superadmin', password: 'superadmin123', landingTab: 'tab-admin' }
];
window.DEMO_ACCOUNTS = DEMO_ACCOUNTS;
var OWNER_ROLE_NAME = 'Super Admin'; window.OWNER_ROLE_NAME = OWNER_ROLE_NAME;
var currentRole = '';
function showTab(id) { document.querySelectorAll('.tab-content').forEach(t => { t.style.display='none'; t.classList.remove('active'); }); const t=document.getElementById(id); if(t){t.style.display='block';t.classList.add('active');} }
function filterTabsByRole(role) { document.querySelectorAll('.tab-btn').forEach(btn => { const allowed=(btn.getAttribute('data-access-roles')||'').split(',').map(r=>r.trim().toLowerCase()); const isOwner=role&&role.toLowerCase()===OWNER_ROLE_NAME.toLowerCase(); btn.style.display=(isOwner||allowed.includes(role.toLowerCase()))?'':'none'; }); }
function loginAs(role) { currentRole=role; document.getElementById('loginScreen').style.display='none'; document.getElementById('appContainer').style.display='block'; filterTabsByRole(role); const matched=DEMO_ACCOUNTS.find(a=>a.role===role); if(matched&&matched.landingTab)showTab(matched.landingTab); }
function handleLogin() { const u=document.getElementById('loginUsername').value.trim().toLowerCase(); const p=document.getElementById('loginPassword').value.trim(); const acc=DEMO_ACCOUNTS.find(a=>a.username===u&&a.password===p); if(acc)loginAs(acc.role); }
function simpanEvaluasi() {}
</script></body></html>`;

const roles = ['Instruktur Musik', 'Super Admin'];

console.log('='.repeat(70));
console.log('TEST BUG B: Validator Field Relasi sebagai Input Teks');
console.log('='.repeat(70));

console.log('\n[TEST 1] HTML BUG B - field relasi sebagai <input type="text">');
const resultBuggy = validateAndRepairGeneratedCode(htmlWithRelasiTextInput, '', '', roles, 'Super Admin');
const relasiIssues = resultBuggy.issues.filter(i => i.includes('RELASI_FIELD'));
if (relasiIssues.length > 0) {
  console.log('  ✅ PASS: Validator mendeteksi field relasi sebagai input teks');
  relasiIssues.forEach(i => console.log(`     → ${i.substring(0, 150)}`));
} else {
  console.log('  ❌ FAIL: Validator TIDAK mendeteksi Bug B');
  console.log('  All issues:', resultBuggy.issues);
}

console.log('\n[TEST 2] HTML FIXED - field relasi sebagai <select>');
const resultFixed = validateAndRepairGeneratedCode(htmlWithRelasiSelectFixed, '', '', roles, 'Super Admin');
const relasiIssuesFixed = resultFixed.issues.filter(i => i.includes('RELASI_FIELD'));
if (relasiIssuesFixed.length === 0) {
  console.log('  ✅ PASS: Tidak ada false positive untuk HTML yang pakai <select>');
} else {
  console.log('  ❌ FAIL: False positive ditemukan');
  relasiIssuesFixed.forEach(i => console.log(`     → ${i}`));
}

const test1Pass = relasiIssues.length > 0;
const test2Pass = relasiIssuesFixed.length === 0;
console.log('\n' + '='.repeat(70));
console.log(`Test 1 (Deteksi Bug B): ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
console.log(`Test 2 (No false pos):  ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);
if (!test1Pass || !test2Pass) process.exit(1);
