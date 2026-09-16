import { applyGuidedAnswer } from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

const laundrySession: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
        templateId: 'LAUNDRY_KILOAN',
        overlayIds: [],
        patternIds: [],
        tier: 'BASIC',
        businessCategory: 'Laundry Kiloan'
    },
    roles: { selected: ['Super Admin', 'Petugas Laundry'] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    storyline: {
        narasi: 'Laundry kiloan yang melayani cuci-setrika per kilogram untuk pelanggan sekitar.',
        asumsiMasalah: 'Nota masih ditulis tangan',
        asumsiAktor: ['Super Admin', 'Petugas Laundry', 'Pelanggan'],
        asumsiAlurUtama: 'Pelanggan antar cucian, petugas timbang dan catat, pelanggan ambil setelah selesai.',
        statusKonfirmasi: 'disetujui'
    }
};

const narasi = (laundrySession.storyline?.narasi || '').toLowerCase();
const alur = (laundrySession.storyline?.asumsiAlurUtama || '').toLowerCase();
const cat = (laundrySession.match?.businessCategory || '').toLowerCase();
const fullText = `${narasi} ${alur} ${cat}`;
console.log('fullText:', JSON.stringify(fullText));
const re = /\b(warung|toko\s*kelontong|bengkel|cuci.*mobil|cuci.*motor|laundry\s*kiloan|kurir|ekspedisi|ojek|grab|dropship)\b/i;
console.log('isClearlyTransactional match:', re.test(fullText));

const result = applyGuidedAnswer(laundrySession, 'STORYTELLING', ['confirm_story'], undefined);
console.log('step =>', result.step);
console.log('pendingProductVariantQuestion =>', JSON.stringify(result.storyline?.pendingProductVariantQuestion ?? null));
console.log('pendingActorClarification =>', JSON.stringify(result.storyline?.pendingActorClarification ?? null));
