import { POST } from '../src/app/api/generate/route';

console.log('================================================================');
console.log('🧪 TEST SUITE: EMERGENCY GUIDED GUARD & ROUTING VERIFICATION');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
  }
}

// SIMULASI LOGIKA FRONTEND ChatPanel.tsx
function simulateFrontendRouting(
  query: string,
  projectState: { canvasCode?: { html?: string }; sessionState?: any; id?: string },
  currentSelectedMode: 'PLAN' | 'BUILD'
): { destination: 'GUIDED' | 'GENERATE'; activeMode: string; stateReset: boolean } {
  const isCanvasEmpty = !projectState.canvasCode?.html;
  let activeMode = isCanvasEmpty ? 'PLAN' : currentSelectedMode;
  let stateReset = false;

  const isExplicitNewAppIdea =
    /(?:buatkan|bikin|buat|buatkan\s+saya|kembangkan|rancang)\s+(?:aplikasi|sistem|app|web\s+app)\b/i.test(query.trim()) ||
    /(?:aplikasi|sistem)\s+(?:cuci\s+mobil|laundry|posyandu|kasir|klinik|rental|bengkel|toko|keuangan|booking|antrean|sekolah|koperasi|restoran|cafe)/i.test(query.trim());

  // SKENARIO NYATA USER: Canvas lama masih ada, langsung ketik ide aplikasi baru
  if (!isCanvasEmpty && isExplicitNewAppIdea) {
    stateReset = true;
    activeMode = 'PLAN';
    return { destination: 'GUIDED', activeMode, stateReset };
  }

  const isQuestionOrGreeting =
    /^(apa|apakah|bagaimana|kenapa|mengapa|bisa|boleh|hallo|halo|hai|selamat|pagi|siang|sore|malam)\b/i.test(query.trim()) ||
    query.trim().endsWith('?');
  const looksLikeIdea = (query.trim().length > 8 && !isQuestionOrGreeting) || isExplicitNewAppIdea;

  if (
    isCanvasEmpty &&
    (!projectState.sessionState || projectState.sessionState.step === 'REVIEW_FINAL' || !projectState.sessionState.step || looksLikeIdea)
  ) {
    if (!projectState.sessionState || projectState.sessionState.step === 'REVIEW_FINAL' || !projectState.sessionState.step) {
      return { destination: 'GUIDED', activeMode, stateReset };
    }
  }

  if (
    activeMode === 'PLAN' &&
    isCanvasEmpty &&
    projectState.sessionState &&
    projectState.sessionState.step &&
    projectState.sessionState.step !== 'REVIEW_FINAL'
  ) {
    return { destination: 'GUIDED', activeMode, stateReset };
  }

  return { destination: 'GENERATE', activeMode, stateReset };
}

// UJI 1: SKENARIO PERSIS USER — Habis testing Barbershop, tanpa refresh langsung ketik 'buatkan aplikasi cuci mobil'
console.log('--- UJI 1: Skenario Persis Pengguna (Tanpa Refresh Setelah Testing Barbershop) ---');
const barbershopProjectState = {
  id: 'proj-barbershop',
  canvasCode: { html: '<html><body>Barbershop Prototype</body></html>' },
  sessionState: { step: 'REVIEW_FINAL', statusKonfirmasi: 'disetujui' }
};

const resultSkenarioUser = simulateFrontendRouting(
  'buatkan aplikasi cuci mobil',
  barbershopProjectState,
  'BUILD'
);

assert(resultSkenarioUser.destination === 'GUIDED', 'Pesan "buatkan aplikasi cuci mobil" diarahkan ke GUIDED INTERVIEW');
assert(resultSkenarioUser.stateReset === true, 'Kanvas lama otomatis di-reset untuk proyek baru');
assert(resultSkenarioUser.activeMode === 'PLAN', 'Mode otomatis kembali ke PLAN');

// UJI 2: SKENARIO RESET PROYEK BARU — Klik Buat Proyek Baru (Canvas Kosong, Mode Tertinggal BUILD)
console.log('\n--- UJI 2: Skenario Buat Proyek Baru (Kanvas Kosong, Mode Tertinggal BUILD) ---');
const freshProjectState = {
  id: 'proj-fresh',
  canvasCode: { html: '' },
  sessionState: null
};

const resultFresh = simulateFrontendRouting(
  'buatkan aplikasi cuci mobil',
  freshProjectState,
  'BUILD' // mode tertinggal
);

assert(resultFresh.destination === 'GUIDED', 'Kanvas kosong dengan mode tertinggal BUILD tetap masuk ke GUIDED INTERVIEW');
assert(resultFresh.activeMode === 'PLAN', 'Mode kanvas kosong dipaksa ke PLAN');

// UJI 3: Variasi Kalimat Pembuka di Sesi Baru
console.log('\n--- UJI 3: Variasi Kalimat Pembuka Pengguna ---');
const variasiPrompt = [
  'buatkan aplikasi cuci mobil',
  'aplikasi cuci mobil',
  'saya mau bikin aplikasi laundry kiloan',
  'sistem pencatatan kasir toko kelontong',
  'buatkan web app booking klinik gigi'
];

for (const p of variasiPrompt) {
  const res = simulateFrontendRouting(p, freshProjectState, 'PLAN');
  assert(res.destination === 'GUIDED', `Prompt "${p}" konsisten masuk ke GUIDED INTERVIEW`);
}

// UJI 4: HARD ARCHITECTURAL GUARD DI BACKEND (/api/generate)
console.log('\n--- UJI 4: Hard Architectural Guard di /api/generate Backend ---');
async function testBackendGuard() {
  // 4a. Request liar: coba generate prototipe baru tanpa session
  const reqTanpaSession = new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
    body: JSON.stringify({
      prompt: 'buatkan aplikasi cuci mobil',
      chatHistory: [],
      stage: 'TAHAP_2_MOCKUP',
      currentCode: '',
      mode: 'BUILD',
      sessionState: null
    })
  });

  const resTanpaSession = await POST(reqTanpaSession);
  const dataTanpaSession = await resTanpaSession.json();

  assert(resTanpaSession.status === 400, 'Backend mengembalikan HTTP 400 untuk request tanpa review final');
  assert(dataTanpaSession.needsGuidedInterview === true, 'Backend mengembalikan flag needsGuidedInterview: true');
  assert(
    dataTanpaSession.error.includes('Guided Interview'),
    'Pesan error backend menegaskan wajib alur Guided Interview'
  );

  // 4b. Request liar dengan session yang BELUM selesai (misal baru di step ALUR)
  const reqSessionBelumSelesai = new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
    body: JSON.stringify({
      prompt: 'buatkan aplikasi cuci mobil',
      chatHistory: [],
      stage: 'TAHAP_2_MOCKUP',
      currentCode: '',
      mode: 'BUILD',
      sessionState: {
        step: 'ALUR',
        statusKonfirmasi: 'belum'
      }
    })
  });

  const resSessionBelumSelesai = await POST(reqSessionBelumSelesai);
  const dataSessionBelumSelesai = await resSessionBelumSelesai.json();
  assert(resSessionBelumSelesai.status === 400, 'Backend menolak sesi yang baru sampai step ALUR');
  assert(dataSessionBelumSelesai.needsGuidedInterview === true, 'needsGuidedInterview bernilai true untuk step ALUR');

  // 4c. Request sah: sudah REVIEW_FINAL dan disetujui (Guard TIDAK memblokir)
  // Catatan: Jika lolos guard, fungsi akan melanjutkan ke auth/AI call.
  // Kita uji apakah lolos guardrail tahap awal (tidak return 400 needsGuidedInterview).
  const reqSah = new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
    body: JSON.stringify({
      prompt: 'Saya menyetujui Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang.',
      chatHistory: [
        { sender: 'AI', text: '📋 Brief Kebutuhan: Nama App: AutoClean' }
      ],
      stage: 'TAHAP_2_MOCKUP',
      currentCode: '',
      mode: 'BUILD',
      sessionState: {
        step: 'REVIEW_FINAL',
        statusKonfirmasi: 'disetujui',
        roles: { selected: ['Super Admin', 'Kasir'] },
        compiledBrief: 'Brief Resmi Cuci Mobil'
      }
    })
  });

  const resSah = await POST(reqSah);
  // Status resSah bisa 200 atau streaming atau API key, asalkan BUKAN 400 needsGuidedInterview
  const isBlockedByGuard = resSah.status === 400 && (await resSah.clone().json().catch(() => ({}))).needsGuidedInterview;
  assert(!isBlockedByGuard, 'Sesi sah dengan REVIEW_FINAL disetujui LOLOS dari Architectural Guard');

  console.log(`\n================================================================`);
  console.log(`HASIL AKHIR: ${passedTests} / ${totalTests} pengujian BERHASIL`);
  console.log(`================================================================`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

testBackendGuard();
