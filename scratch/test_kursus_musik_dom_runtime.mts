import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { buildSrcDoc } from '../src/lib/buildSrcDoc';

const html = fs.readFileSync(path.resolve(process.cwd(), 'scratch/kursus_musik_generated.html'), 'utf8');
let finalSrcDoc = buildSrcDoc({ html, css: '', js: '' });
finalSrcDoc = finalSrcDoc.replace(/<script\s+src=[^>]*><\/script>/gi, '');

fs.writeFileSync(path.resolve(process.cwd(), 'scratch/kursus_musik_full_srcdoc.html'), finalSrcDoc);

console.log('=== TESTING DOM RUNTIME KURSUS MUSIK ===\n');

const errors: string[] = [];
const logs: string[] = [];

const virtualConsole = new (await import('jsdom')).VirtualConsole();
virtualConsole.on('jsdomError', (error) => {
  console.log('>>> JSDOM ERROR:', error.message);
});
virtualConsole.on('error', (err) => {
  console.log('>>> WINDOW ERROR:', err);
});

const dom = new JSDOM(finalSrcDoc, {
  runScripts: 'dangerously',
  resources: 'usable',
  virtualConsole
});

const { window } = dom;
const { document } = window;

// Trigger DOMContentLoaded
const domLoadedEvent = new window.Event('DOMContentLoaded');
window.document.dispatchEvent(domLoadedEvent);

console.log('Errors immediately after load:', errors);

// Cek elemen login
const loginScreen = document.getElementById('loginScreen');
console.log('Login screen exists:', Boolean(loginScreen));
console.log('Login screen display style:', loginScreen?.style.display);

// Cek tombol quickLogin
const quickLoginSuperAdmin = document.querySelector('[onclick*="superadmin"]');
console.log('QuickLogin Super Admin button exists:', Boolean(quickLoginSuperAdmin));

// Klik Quick Login Super Admin
console.log('\n--- KLIK QUICK LOGIN SUPER ADMIN ---');
try {
  (quickLoginSuperAdmin as any)?.click();
} catch (e: any) {
  console.error('Exception on quickLogin click:', e.message);
}
console.log('Errors after quickLogin:', errors);

const appContainer = document.getElementById('appContainer');
console.log('App container display after login:', appContainer?.style.display);
console.log('Login screen display after login:', loginScreen?.style.display);
console.log('window.currentRole:', (window as any).currentRole);

// Cek tab buttons
const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
console.log('\nTab buttons total:', tabBtns.length);
tabBtns.forEach(btn => {
  console.log(`- Tab: "${btn.textContent?.trim()}", roles: "${btn.getAttribute('data-access-roles')}", display: "${(btn as any).style.display}"`);
});

// Klik tab lain
const muridTab = document.querySelector('.tab-btn[data-access-roles="Murid"]');
console.log('\n--- KLIK TAB MURID SEBAGAI SUPER ADMIN ---');
try {
  (muridTab as any)?.click();
} catch (e: any) {
  console.error('Exception on muridTab click:', e.message);
}

// Buka Modal Tambah
console.log('\n--- KLIK BUKA MODAL TAMBAH ---');
const btnTambah = document.querySelector('button[onclick*="bukaModalTambah"]');
console.log('btnTambah exists:', Boolean(btnTambah));
try {
  (btnTambah as any)?.click();
} catch (e: any) {
  console.error('Exception on btnTambah click:', e.message);
}
console.log('Errors after bukaModalTambah:', errors);
const modalForm = document.getElementById('modalForm');
console.log('modalForm display:', modalForm?.style.display);

// Klik Simpan Form
console.log('\n--- KLIK SIMPAN FORM ---');
const btnSimpan = document.querySelector('button[onclick*="simpanForm"]');
try {
  (btnSimpan as any)?.click();
} catch (e: any) {
  console.error('Exception on simpanForm click:', e.message);
}
console.log('Errors after simpanForm:', errors);

// Klik Buka Modal Edit
console.log('\n--- TEST LOGIN SEBAGAI MURID ---');
try {
  (window as any).loginAs('Murid');
} catch (e: any) {
  console.error('Exception on loginAs Murid:', e.message);
}
console.log('window.currentRole:', (window as any).currentRole);
tabBtns.forEach(btn => {
  console.log(`- Tab: "${btn.textContent?.trim()}", roles: "${btn.getAttribute('data-access-roles')}", display: "${(btn as any).style.display}"`);
});
const activeTab = document.querySelector('.tab-content.active');
console.log('Active tab ID for Murid:', activeTab?.id);
console.log('Active tab innerHTML snippet:', activeTab?.innerHTML.slice(0, 300));
