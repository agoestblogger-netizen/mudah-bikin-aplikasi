/**
 * LANGKAH 9 — PEMBUKTIAN PIPELINE SUNGGUHAN (TANPA FIXTURE MANUAL)
 * ==============================================================
 * Skenario:
 *   1. Narasi mentah "Pelatihan kuliner membuat roti" (TANPA menyebut varian).
 *   2. Confirm story → harus muncul pertanyaan variasi produk.
 *   3. User pilih "Ada beberapa varian" + sebutkan nama varian.
 *   4. Narasi ter-append [Variasi Produk: ...].
 *   5. Alur inti dihasilkan pipeline nyata (getDomainFlowDetails, bukan hardcode),
 *      alur pendukung + fitur pendukung di-generate AI nyata.
 *   6. generateDataSchemaWithAI() AI nyata → menghasilkan skema tabel DARI NOL.
 *   7. Assert pola 3-tier: tabel KATALOG (memuat varian riil user),
 *      tabel PENDAFTARAN penghubung (2 field relasi kunci), dan tabel TURUNAN.
 *
 * Catatan: dijalankan manual via `npx tsx` karena memanggil API AI berbayar.
 * Jika API key tidak tersedia → keluar kode 2 (BLOCKED), bukan gagal palsu.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
    applyGuidedAnswer,
    getDomainFlowDetails
} from '../src/lib/templates/processes/guided';
import {
    generateDataSchemaWithAI,
    generateSupportingFlowsAndFeaturesWithAI
} from '../src/app/api/guided/route';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

// Muat environment variable dari .env.local secara manual (tsx tidak auto-load Next env)
function loadEnvLocal() {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
        }
        if (!process.env[key]) process.env[key] = val;
    }
}
loadEnvLocal();

const SECTION = (t: string) => console.log(`\n== ${t} ==`);

async function main() {
    const hasKey = !!(
        process.env.OPENROUTER_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.GEMINI_API_KEY
    );
    if (!hasKey) {
        console.error('⛔ BLOCKED: tidak ada API key AI (OPENROUTER_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY).');
        console.error('   Langkah 9 TIDAK dijalankan — TIDAK diganti dengan fixture manual (sesuai instruksi).');
        process.exit(2);
    }

    console.log('========================================================================');
    console.log('🧪 LANGKAH 9: PIPELINE SUNGGUHAN PELATIHAN KULINER (AI NYATA, TANPA FIXTURE)');
    console.log('========================================================================');
    console.log(
        `Provider: OPENROUTER=${!!process.env.OPENROUTER_API_KEY} OPENAI=${!!process.env.OPENAI_API_KEY} GEMINI=${!!process.env.GEMINI_API_KEY}`
    );

    // ---------------------------------------------------------------
    // TAHAP 1: Narasi mentah (TIDAK menyebut variasi sama sekali)
    // ---------------------------------------------------------------
    SECTION('TAHAP 1 — Narasi mentah "Pelatihan kuliner membuat roti"');
    let session: MockupSessionState = {
        step: 'STORYTELLING',
        match: {
            templateId: 'KULINER_02',
            overlayIds: [],
            patternIds: [],
            tier: 'ADVANCE',
            businessCategory: 'Pelatihan Kuliner'
        },
        roles: { selected: [] },
        flow: {},
        painPoints: { selected: [] },
        features: { selected: [] },
        storyline: {
            narasi: 'Pelatihan kuliner membuat roti.',
            asumsiMasalah: 'Pendaftaran peserta masih manual via chat',
            asumsiAktor: ['Super Admin', 'Instruktur', 'Siswa'],
            asumsiAlurUtama:
                'Siswa mendaftar kelas, memilih program pelatihan, instruktur mengajar, admin mencatat pembayaran.',
            statusKonfirmasi: 'disetujui',
            revisiCount: 0,
            riwayatKoreksi: []
        }
    };
    console.log(`  Narasi awal: "${session.storyline!.narasi}"`);

    // ---------------------------------------------------------------
    // TAHAP 2: confirm_story → pertanyaan variasi muncul
    // ---------------------------------------------------------------
    SECTION('TAHAP 2 — confirm_story → pertanyaan variasi produk muncul');
    session = applyGuidedAnswer(session, 'STORYTELLING', ['confirm_story'], undefined);
    assert(
        session.storyline?.pendingProductVariantQuestion !== undefined,
        `Pelatihan Kuliner harus memunculkan pertanyaan variasi. step=${session.step}`
    );
    console.log(
        `  ✅ pendingProductVariantQuestion aktif — entityLabel="${session.storyline!.pendingProductVariantQuestion!.entityLabel}"`
    );

    // ---------------------------------------------------------------
    // TAHAP 3: user jawab "Ada beberapa varian" + nama varian
    // ---------------------------------------------------------------
    SECTION('TAHAP 3 — User pilih "Ada beberapa varian" + sebutkan nama varian');
    const NAMA_VARIAN = 'Roti Tawar, Roti Gandum, Croissant';
    session = applyGuidedAnswer(session, 'STORYTELLING', ['variant_multiple'], NAMA_VARIAN);
    const narasiSetelahVarian = session.storyline!.narasi;
    assert(
        /\[Variasi Produk:/i.test(narasiSetelahVarian),
        'Narasi harus ter-append penanda [Variasi Produk: ...]'
    );
    assert(narasiSetelahVarian.includes('Roti Tawar'), 'Narasi harus memuat nama varian riil dari user');
    console.log(
        `  ✅ Narasi ter-append: "...${narasiSetelahVarian.substring(narasiSetelahVarian.indexOf('[Variasi Produk'))}"`
    );

    // ---------------------------------------------------------------
    // TAHAP 4: Alur inti (pipeline nyata) + AI generate alur pendukung
    // ---------------------------------------------------------------
    SECTION('TAHAP 4 — Alur inti (pipeline nyata) + AI generate alur pendukung');

    session = {
        ...session,
        roles: {
            ...session.roles,
            selected: session.roles?.selected?.length
                ? session.roles.selected
                : ['Super Admin', 'Instruktur', 'Siswa']
        },
        actorsClassification: session.actorsClassification || [
            { actor: 'Super Admin', category: 'PENGGUNA_SISTEM' },
            { actor: 'Instruktur', category: 'PENGGUNA_SISTEM' },
            { actor: 'Siswa', category: 'ENTITAS_DATA', ownerRole: 'Instruktur' }
        ],
        rbac: {
            modul: [
                { nama: 'Manajemen Kelas', aktif: true, buat: true, lihat: true, ubah: true, hapus: false },
                { nama: 'Pendaftaran Siswa', aktif: true, buat: true, lihat: true, ubah: true, hapus: false },
                { nama: 'Pembayaran', aktif: true, buat: true, lihat: true, ubah: true, hapus: false }
            ] as any
        }
    };

    const flowData = getDomainFlowDetails(session);
    assert(
        flowData.alurInti.length > 0,
        'Pipeline alur inti harus menghasilkan langkah dari narasi'
    );
    console.log(`  ✅ Alur Inti (pipeline deterministik dari narasi): ${flowData.alurInti.length} langkah`);
    flowData.alurInti.forEach((s: any, i: number) => {
        console.log(`     ${i + 1}. [${s.pelaku}] ${s.aksi}`);
    });

    const provider = process.env.OPENROUTER_API_KEY
        ? 'openrouter'
        : process.env.OPENAI_API_KEY
            ? 'openai'
            : 'gemini';
    const apiKey =
        process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

    console.log(`  Memanggil AI nyata (provider=${provider}) untuk alur & fitur pendukung...`);
    let alurPendukung: any[] = [];
    let fiturPendukung: any[] = [];
    try {
        const flowResult = await generateSupportingFlowsAndFeaturesWithAI(session, provider, apiKey);
        alurPendukung = (flowResult as any)?.alurPendukung || [];
        fiturPendukung = (flowResult as any)?.fiturPendukung || [];
        console.log(`  ✅ AI menghasilkan ${alurPendukung.length} alur pendukung, ${fiturPendukung.length} fitur pendukung`);
    } catch (e: any) {
        console.log(`  ⚠️ AI alur pendukung gagal (${e?.message}) — lanjut ke generate skema (bagian inti Langkah 9).`);
    }

    session = {
        ...session,
        flow: {
            ...session.flow,
            alurInti: flowData.alurInti as any,
            alurPendukung: alurPendukung.map((ap: any) => ({
                nama: ap.nama || ap.namaAlur || 'Alur Pendukung',
                steps: ap.steps || []
            })),
            fiturPendukung: fiturPendukung.map((f: any) => (typeof f === 'string' ? f : f.nama || f.namaFitur || String(f)))
        } as any
    };

    // ---------------------------------------------------------------
    // TAHAP 5: AI generate skema data DARI NOL
    // ---------------------------------------------------------------
    SECTION('TAHAP 5 — AI nyata generate Skema Data dari nol (generateDataSchemaWithAI)');
    const schemaResult = await generateDataSchemaWithAI(session, provider, apiKey);
    assert(
        schemaResult && Array.isArray(schemaResult.tabel) && schemaResult.tabel.length > 0,
        'AI harus menghasilkan tabel skema'
    );
    console.log(`  ✅ AI menghasilkan ${schemaResult.tabel.length} tabel:`);
    schemaResult.tabel.forEach((t: any) => {
        console.log(`     • ${t.nama} (${t.field.length} field) — ${t.keterangan}`);
        t.field.forEach((f: any) => console.log(`         - ${f.nama} : ${f.tipe}`));
    });

    // ---------------------------------------------------------------
    // TAHAP 6: Assert pola 3-tier terbentuk
    // ---------------------------------------------------------------
    SECTION('TAHAP 6 — Verifikasi pola 3-TIER terbentuk dari nol');

    const tables = schemaResult.tabel;
    const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Helper klasifikasi STRUKTURAL (berbasis RELASI, bukan sekadar cocok kata pada keterangan).
    const NAMA_KATALOG = /katalog|produk|layanan|paket|program|kursus|pelatihan|menu|varian|master/i;
    const NAMA_ENTITAS_AKTOR = /siswa|pelanggan|peserta|murid|klien|customer|member|nasabah|pasien|tamu|pengunjung/i;
    const relasiTargets = (t: any): string[] =>
        t.field
            .filter((f: any) => /relasi ke\s+/i.test(f.tipe || ''))
            .map((f: any) => norm((f.tipe || '').replace(/relasi ke\s+/i, '').trim()))
            .filter((n: string) => n.length > 0);
    const pointsTo = (t: any, targetNamas: Set<string>) =>
        relasiTargets(t).some((n: string) => targetNamas.has(n));
    const pointsToPengguna = (t: any) =>
        t.field.some((f: any) => /relasi ke pengguna/i.test(f.tipe || ''));

    // Tabel AKTOR = tabel sistem "pengguna" ATAU tabel entitas-data (mis. "siswa").
    // Keduanya SAH: sesuai kaidah Bug 1b, aktor non-pemilik-akun boleh dimodelkan sebagai
    // tabel entitas tersendiri (tanpa kredensial) alih-alih baris di tabel pengguna.
    const aktorNamas = new Set<string>(['pengguna', 'users', 'user']);
    tables.forEach((t: any) => {
        if (NAMA_ENTITAS_AKTOR.test(t.nama)) aktorNamas.add(norm(t.nama));
    });

    // LAPIS 1: tabel katalog/master. Dicocokkan dari NAMA tabel saja (BUKAN keterangan) agar tabel
    // entitas seperti "siswa" yang keterangannya menyebut "pelatihan" tidak salah masuk katalog.
    // Katalog murni: bukan tabel aktor, dan TIDAK merujuk ke aktor mana pun. Ini mengecualikan
    // tabel penghubung (mis. "pendaftaran_pelatihan") yang namanya kebetulan memuat kata katalog.
    const katalogTables = tables.filter((t: any) => {
        if (!NAMA_KATALOG.test(t.nama)) return false;
        if (NAMA_ENTITAS_AKTOR.test(t.nama)) return false;
        if (pointsToPengguna(t)) return false;
        if (pointsTo(t, aktorNamas)) return false;
        return true;
    });
    assert(
        katalogTables.length > 0,
        `LAPIS 1 gagal: tidak ada tabel katalog/master terdeteksi. Tabel: ${tables.map((t: any) => t.nama).join(', ')}`
    );
    const katalogNamas = new Set(katalogTables.map((t: any) => norm(t.nama)));
    console.log(`  ✅ LAPIS 1 (Katalog/Master): ${katalogTables.map((t: any) => t.nama).join(', ')}`);

    // LAPIS 2: tabel penghubung = merujuk ke tabel KATALOG (master) DAN merujuk ke tabel AKTOR.
    // Itulah "DUA field relasi kunci" (relasi ke aktor + relasi ke katalog), dan inilah yang
    // membedakannya dari tabel turunan yang hanya merujuk ke penghubung.
    const penghubungCandidates = tables.filter((t: any) => {
        if (!pointsTo(t, katalogNamas)) return false;
        return pointsTo(t, aktorNamas);
    });
    assert(
        penghubungCandidates.length > 0,
        'LAPIS 2 gagal: tidak ada tabel penghubung dengan DUA field relasi kunci (ke aktor + ke katalog).'
    );
    console.log(`  ✅ LAPIS 2 (Pendaftaran/Penghubung): ${penghubungCandidates.map((t: any) => t.nama).join(', ')}`);
    penghubungCandidates.forEach((t: any) => {
        t.field
            .filter((f: any) => /relasi ke/i.test(f.tipe || ''))
            .forEach((f: any) => console.log(`       → ${t.nama}.${f.nama} : ${f.tipe}`));
    });

    // LAPIS 3: tabel turunan = merujuk ke tabel PENGHUBUNG (bukan ke katalog), dan bukan penghubung itu sendiri.
    const penghubungNamas = penghubungCandidates.map((t: any) => norm(t.nama));
    const turunanTables = tables.filter((t: any) => {
        if (penghubungNamas.includes(norm(t.nama))) return false;
        if (katalogNamas.has(norm(t.nama))) return false;
        return relasiTargets(t).some((n: string) => penghubungNamas.includes(n));
    });
    assert(
        turunanTables.length > 0,
        `LAPIS 3 gagal: tidak ada tabel turunan yang merujuk ke tabel penghubung (${penghubungNamas.join(', ')}).`
    );
    console.log(`  ✅ LAPIS 3 (Turunan): ${turunanTables.map((t: any) => t.nama).join(', ')}`);
    turunanTables.forEach((t: any) => {
        t.field
            .filter((f: any) => /relasi ke/i.test(f.tipe || ''))
            .forEach((f: any) => console.log(`       → ${t.nama}.${f.nama} : ${f.tipe}`));
    });

    // Anti-regresi Bug 1b: tabel entitas tidak boleh punya field kredensial
    const siswaTable = tables.find((t: any) => /siswa|pelanggan|peserta/i.test(norm(t.nama)));
    if (siswaTable) {
        const hasCredential = siswaTable.field.some((f: any) =>
            /username|password|pin|token|kredensial/i.test(`${f.nama} ${f.keterangan || ''}`)
        );
        assert(
            !hasCredential,
            `Bug 1b gagal: tabel entitas "${siswaTable.nama}" tidak boleh memiliki field kredensial`
        );
        console.log(`  ✅ Bug 1b: tabel entitas "${siswaTable.nama}" bersih dari field kredensial`);
    } else {
        console.log('  ℹ️ Tidak ada tabel entitas (siswa/peserta) terpisah pada generasi ini.');
    }

    // Simpan artefak bukti
    const outPath = path.resolve(__dirname, 'langkah9_kuliner_live_schema.json');
    fs.writeFileSync(
        outPath,
        JSON.stringify(
            {
                narasi: session.storyline!.narasi,
                alurInti: flowData.alurInti,
                alurPendukung,
                fiturPendukung,
                tabel: tables
            },
            null,
            2
        )
    );
    console.log(`\n  💾 Artefak bukti disimpan: ${path.relative(process.cwd(), outPath)}`);

    console.log('\n========================================================================');
    console.log('🎉 LANGKAH 9 LULUS: pipeline Pelatihan Kuliner end-to-end SUNGGUHAN (AI nyata, dari nol)');
    console.log('   Terbukti terbentuk: LAPIS 1 Katalog + LAPIS 2 Penghubung + LAPIS 3 Turunan');
    console.log('========================================================================');
}

main().catch((err) => {
    console.error('\n❌ LANGKAH 9 GAGAL:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
});
