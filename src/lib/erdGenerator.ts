/**
 * Generator Sintaks Mermaid erDiagram dari Skema Data Tabel (Bagian D)
 * Menghasilkan representasi visual ERD lengkap (dbdiagram style) dengan kardinalitas relasi,
 * penandaan PK, dan FK.
 */

export interface SchemaFieldForErd {
  nama: string;
  tipe: string;
  keterangan?: string;
  targetTable?: string;
  targetRole?: string;
  isFormula?: boolean;
  formulaExpression?: string;
}

export interface SchemaTableForErd {
  nama: string;
  keterangan?: string;
  displayField?: string;
  compositeFields?: string[];
  field: SchemaFieldForErd[];
}

function sanitizeName(str: string): string {
  if (!str) return 'unknown';
  // Bersihkan karakter selain alfanumerik dan underscore
  let clean = str.replace(/[^a-zA-Z0-9_]/g, '_').trim();
  // Mermaid entitas tidak boleh diawali angka
  if (/^[0-9]/.test(clean)) {
    clean = 'tbl_' + clean;
  }
  return clean;
}

function mapToMermaidType(tipe: string): string {
  const t = (tipe || '').toLowerCase();
  if (t.includes('angka') || t.includes('number') || t.includes('integer') || t.includes('int')) {
    return 'int';
  }
  if (t.includes('decimal') || t.includes('float') || t.includes('nominal') || t.includes('harga') || t.includes('biaya')) {
    return 'float';
  }
  if (t.includes('tanggal') || t.includes('date') || t.includes('time')) {
    return 'date';
  }
  if (t.includes('boolean') || t.includes('bool') || t.includes('status_aktif')) {
    return 'boolean';
  }
  return 'string';
}

/**
 * Menghasilkan kode diagram Mermaid erDiagram dari daftar tabel skema.
 * Secara default menggunakan mode ringkas (compactMode = true): hanya menampilkan nama tabel + baris PK dan FK,
 * agar diagram tidak terlalu tinggi dan seluruh tabel terlihat jelas dalam satu viewport.
 */
export function generateMermaidErDiagram(tables: SchemaTableForErd[], compactMode: boolean = true): string {
  if (!tables || tables.length === 0) {
    return 'erDiagram\n    INFO {\n        string pesan "Belum ada tabel skema terdefinisi"\n    }';
  }

  const lines: string[] = ['erDiagram'];
  const relationships: string[] = [];
  const addedRelations = new Set<string>();

  // 1. Ekstrak Relasi antar Tabel
  for (const tbl of tables) {
    const sourceName = sanitizeName(tbl.nama).toUpperCase();

    for (const fld of tbl.field) {
      const fName = (fld.nama || '').toLowerCase();
      const fType = (fld.tipe || '').toLowerCase();
      const isRelasi = fType.includes('relasi ke') || fName.endsWith('_id') || (fName.startsWith('id_') && fName !== 'id');

      if (!isRelasi || fName === 'id') continue;

      let targetTblName = '';
      if (fld.targetTable) {
        targetTblName = fld.targetTable;
      } else {
        const match = fType.match(/relasi ke\s+([a-zA-Z0-9_]+)/i);
        if (match) {
          targetTblName = match[1];
        } else {
          targetTblName = fName.replace(/(_id|^id_)/g, '');
        }
      }

      // Cari apakah target table ada di daftar tabel
      const matchedTarget = tables.find(
        (t) => t.nama.toLowerCase() === targetTblName.toLowerCase() ||
               t.nama.toLowerCase().includes(targetTblName.toLowerCase()) ||
               targetTblName.toLowerCase().includes(t.nama.toLowerCase())
      );

      if (matchedTarget) {
        const targetName = sanitizeName(matchedTarget.nama).toUpperCase();
        if (targetName !== sourceName) {
          const relKey = `${targetName}->${sourceName}`;
          if (!addedRelations.has(relKey)) {
            addedRelations.add(relKey);
            // Kardinalitas: Target (Master/1) ke Source (Jembatan/Banyak) = ||--o{
            // Ambil label ringkas yang bersih tanpa pemotongan kata acak
            let label = 'relasi';
            if (fld.keterangan) {
              const cleanDesc = fld.keterangan.replace(/["\n\r]/g, '').trim();
              label = cleanDesc.length > 35 ? cleanDesc.slice(0, 32) + '...' : cleanDesc;
            }
            relationships.push(`    ${targetName} ||--o{ ${sourceName} : "${label}"`);
          }
        }
      }
    }
  }

  // Masukkan seluruh deklarasi relasi di awal
  lines.push(...relationships);

  // 2. Deklarasi Struktur Tabel dan Field (Mode Ringkas: Hanya PK & FK tanpa kolom keterangan)
  for (const tbl of tables) {
    const tblName = sanitizeName(tbl.nama).toUpperCase();
    lines.push(`    ${tblName} {`);

    // Saring field: jika compactMode aktif, ambil hanya PK dan FK
    const keyFields = tbl.field.filter((fld) => {
      const fNameLower = (fld.nama || '').toLowerCase();
      const fTypeLower = (fld.tipe || '').toLowerCase();
      const isPk = fNameLower === 'id' || fNameLower.endsWith('_pk');
      const isFk = fTypeLower.includes('relasi ke') || fNameLower.endsWith('_id') || (fNameLower.startsWith('id_') && fNameLower !== 'id');
      return isPk || isFk;
    });

    // Jaring pengaman: Mermaid membutuhkan minimal 1 field per entitas agar sintaks tidak error
    const fieldsToRender = compactMode
      ? (keyFields.length > 0 ? keyFields : [{ nama: 'id', tipe: 'text', keterangan: 'PK' }])
      : tbl.field;

    for (const fld of fieldsToRender) {
      const fName = sanitizeName(fld.nama);
      const mType = mapToMermaidType(fld.tipe);
      const fNameLower = (fld.nama || '').toLowerCase();
      const fTypeLower = (fld.tipe || '').toLowerCase();
      const isPk = fNameLower === 'id' || fNameLower.endsWith('_pk');
      const isFk = fTypeLower.includes('relasi ke') || fNameLower.endsWith('_id') || (fNameLower.startsWith('id_') && fNameLower !== 'id');

      let modifier = '';
      if (isPk) modifier = 'PK';
      else if (isFk) modifier = 'FK';

      // Di mode ringkas, HAPUS kolom komentar/keterangan sepenuhnya (tidak ada "PK" atau "FK" ganda sebagai teks komentar)
      let comment = '';
      if (!compactMode) {
        if (fld.isFormula && fld.formulaExpression) {
          comment = `"Formula: ${fld.formulaExpression.replace(/["\n]/g, "'")}"`;
        } else if (fld.keterangan) {
          const shortDesc = fld.keterangan.replace(/["\n]/g, "'").slice(0, 30);
          comment = `"${shortDesc}"`;
        }
      }

      const parts = [mType, fName, modifier, comment].filter(Boolean);
      lines.push(`        ${parts.join(' ')}`);
    }

    lines.push('    }');
  }

  return lines.join('\n');
}
