'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Edit3,
  Rocket,
  Send,
  RotateCcw,
  Sparkles,
  Users,
  Layers,
  Zap,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface PageSectionDetail {
  pageName: string;
  isDefault: boolean;
  sections: string[];
  fields: ChecklistItem[];
  actions: ChecklistItem[];
}

export interface RoleDetail {
  roleName: string;
  selected: boolean;
  pages: PageSectionDetail[];
  alurProses?: string;
}

export interface ParsedBriefKebutuhan {
  introText?: string;
  appName: string;
  orientation?: string;
  visualTheme?: string;
  features: ChecklistItem[];
  roadmap?: string[];
  usp?: string;
  roles: RoleDetail[];
  closingQuestion?: string;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Buat field & action default yang cerdas berdasarkan nama page/section
 * jika teks brief awal belum merinci field secara eksplisit.
 */
function createDefaultFieldsAndActions(pageName: string, sections: string[]): {
  fields: ChecklistItem[];
  actions: ChecklistItem[];
} {
  const combined = `${pageName} ${sections.join(' ')}`.toLowerCase();
  
  const fields: ChecklistItem[] = [];
  const actions: ChecklistItem[] = [];

  if (combined.includes('input') || combined.includes('tambah') || combined.includes('daftar') || combined.includes('kelola') || combined.includes('form') || combined.includes('buku') || combined.includes('master')) {
    fields.push(
      { id: generateId(), text: 'Judul / Nama Item (Text)', checked: true },
      { id: generateId(), text: 'Kategori / Klasifikasi (Dropdown)', checked: true },
      { id: generateId(), text: 'Deskripsi / Detail Keterangan (Textarea)', checked: true },
      { id: generateId(), text: 'Status / Ketersediaan (Badge/Select)', checked: true }
    );
    actions.push(
      { id: generateId(), text: 'onclick: Simpan Data Baru (Validasi form & simpan ke state/tabel)', checked: true },
      { id: generateId(), text: 'onclick: Reset / Batal (Kosongkan input form)', checked: true }
    );
  } else if (combined.includes('riwayat') || combined.includes('laporan') || combined.includes('monitoring') || combined.includes('katalog') || combined.includes('cari')) {
    fields.push(
      { id: generateId(), text: 'Kolom Pencarian Kata Kunci (Search Input)', checked: true },
      { id: generateId(), text: 'Filter Periode / Kategori (Dropdown)', checked: true },
      { id: generateId(), text: 'Tabel Data & Status Aktif (List Grid)', checked: true }
    );
    actions.push(
      { id: generateId(), text: 'onclick: Terapkan Filter & Cari (Filter real-time tabel)', checked: true },
      { id: generateId(), text: 'onclick: Lihat Detail / Tindakan Cepat (Modal info & aksi status)', checked: true }
    );
  } else {
    fields.push(
      { id: generateId(), text: 'Nama / Identitas Pengguna (Text)', checked: true },
      { id: generateId(), text: 'Kategori Pilihan (Dropdown)', checked: true },
      { id: generateId(), text: 'Catatan / Deskripsi (Text)', checked: true }
    );
    actions.push(
      { id: generateId(), text: 'onclick: Konfirmasi / Proses (Eksekusi alur utama)', checked: true },
      { id: generateId(), text: 'onclick: Batal / Kembali', checked: true }
    );
  }

  return { fields, actions };
}

/**
 * Parser untuk membedah teks Markdown Brief Kebutuhan menjadi objek terstruktur.
 */
export function parseBriefKebutuhan(text: string): ParsedBriefKebutuhan | null {
  if (!text || typeof text !== 'string') return null;

  const briefMarkerIndex = text.search(/📋\s*\*\*Brief Kebutuhan\*\*|\*\*Brief Kebutuhan\*\*/i);
  if (briefMarkerIndex === -1) return null;

  if (!/Nama App/i.test(text) && !/Fitur Utama/i.test(text)) return null;

  try {
    const introText = text.substring(0, briefMarkerIndex).trim();
    const briefContent = text.substring(briefMarkerIndex);

    let cardContent = briefContent;
    let closingQuestion = '';
    
    const closingMatch = briefContent.search(/\n\s*(Apakah\s+(?:lembar\s+)?Brief\s+Kebutuhan|Apakah\s+ada\s+detail|Silakan\s+konfirmasi)/i);
    if (closingMatch !== -1) {
      cardContent = briefContent.substring(0, closingMatch).trim();
      closingQuestion = briefContent.substring(closingMatch).trim();
    }

    // 1. Ekstrak Nama App
    const appNameMatch = cardContent.match(/-\s*\*\*Nama App\*\*:\s*([^\n]+)/i);
    const appName = appNameMatch ? appNameMatch[1].trim() : 'Aplikasi Web';

    // 2. Ekstrak Orientasi UI
    const orientationMatch = cardContent.match(/-\s*\*\*Orientasi UI\*\*:\s*([^\n]+)/i);
    const orientation = orientationMatch ? orientationMatch[1].trim() : 'Mobile-first, untuk memudahkan pengguna mengakses aplikasi melalui perangkat ponsel.';

    // 3. Ekstrak Tema Visual
    const visualThemeMatch = cardContent.match(/-\s*\*\*Tema Visual\*\*:\s*([^\n]+)/i);
    const visualTheme = visualThemeMatch ? visualThemeMatch[1].trim() : 'Warna cerah dan segar, dengan gaya modern yang ramah pengguna, mengedepankan kemudahan navigasi.';

    // 4. Ekstrak Fitur Utama (V1) sebagai checklist items
    const features: ChecklistItem[] = [];
    const featuresBlockMatch = cardContent.match(/-\s*\*\*Fitur Utama(?:\s*\(V1\))?\*\*:\s*\n([\s\S]*?)(?=\n-\s*\*\*|$)/i);
    if (featuresBlockMatch) {
      const lines = featuresBlockMatch[1].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^\s*(?:\d+\.|\*|-|\[[ xX]\])\s*/, '').replace(/^\[[ xX]\]\s*/, '').trim();
        if (cleaned) {
          features.push({
            id: generateId(),
            text: cleaned,
            checked: true
          });
        }
      }
    }

    // 5. Ekstrak Roadmap Lanjutan (V2/V3)
    const roadmap: string[] = [];
    const roadmapBlockMatch = cardContent.match(/-\s*\*\*Roadmap Lanjutan(?:\s*\(V2\/V3\))?\*\*:\s*\n([\s\S]*?)(?=\n-\s*\*\*|$)/i);
    if (roadmapBlockMatch) {
      const lines = roadmapBlockMatch[1].split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^\s*(?:\d+\.|\*|-)\s*/, '').trim();
        if (cleaned) roadmap.push(cleaned);
      }
    }

    // 6. Ekstrak Fitur Unik (USP)
    const uspMatch = cardContent.match(/-\s*\*\*Fitur Unik(?:\s*\(USP\))?\*\*:\s*([^\n]+)/i);
    const usp = uspMatch ? uspMatch[1].trim() : undefined;

    // 7. Ekstrak Job Description & Struktur Halaman per Role
    const roles: RoleDetail[] = [];
    const rolesBlockMatch = cardContent.match(/-\s*\*\*Job Description[\s\S]*?\*\*:\s*\n([\s\S]*?)$/i);
    
    if (rolesBlockMatch) {
      const rawRolesText = rolesBlockMatch[1];
      const lines = rawRolesText.split('\n');
      let currentRole: RoleDetail | null = null;
      let currentPage: PageSectionDetail | null = null;
      let parsingSection: 'none' | 'fields' | 'actions' = 'none';
      const forbiddenKeywords = ['job description', 'struktur halaman', 'alur proses', 'alur', 'fitur utama', 'roadmap', 'catatan', 'fitur unik', 'nama peran', 'peran 1', 'role 1'];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Cek baris Header Role (misal: `* **Admin**:` atau `* **[Admin]**:` atau `- **Kasir**:`)
        const roleHeaderMatch = trimmed.match(/^[\*\-]\s*\*\*\[?([A-Za-z0-9\s\/\-_]+?)\]?\*\*:?$/) ||
                                trimmed.match(/^\*\*\[?([A-Za-z0-9\s\/\-_]+?)\]?\*\*:?$/);

        if (roleHeaderMatch) {
          let rName = roleHeaderMatch[1].replace(/[\*\[\]:]/g, '').trim();
          const isForbidden = forbiddenKeywords.some(k => rName.toLowerCase().startsWith(k));
          
          if (rName && !isForbidden) {
            rName = rName.replace(/^(?:Role|Peran)\s+/i, '').trim();
            currentRole = {
              roleName: rName,
              selected: true,
              pages: []
            };
            roles.push(currentRole);
            currentPage = null;
            parsingSection = 'none';
            continue;
          }
        }

        // Cek baris Alur Proses di bawah role saat ini
        if (currentRole && /^(?:[\*\-]\s*)?(?:\*\*)?Alur\s+Proses(?:\*\*)?:?/i.test(trimmed)) {
          const alurText = trimmed.replace(/^(?:[\*\-]\s*)?(?:\*\*)?Alur\s+Proses(?:\*\*)?:?\s*/i, '').trim();
          if (alurText) {
            currentRole.alurProses = alurText;
          }
          parsingSection = 'none';
          continue;
        }

        // Cek sub-kategori Field Input atau Action / Event
        if (currentPage && /Field(?:\s+Input)?:/i.test(trimmed)) {
          currentPage.fields = []; // Kosongkan default karena ada deklarasi eksplisit dari AI/pengguna
          parsingSection = 'fields';
          continue;
        }
        if (currentPage && /(?:Action|Event)(?:\s*\/\s*Event)?:/i.test(trimmed)) {
          currentPage.actions = []; // Kosongkan default karena ada deklarasi eksplisit dari AI/pengguna
          parsingSection = 'actions';
          continue;
        }

        // Jika sedang parsing items di bawah Field Input atau Action
        if (currentPage && (parsingSection === 'fields' || parsingSection === 'actions')) {
          const isChecklistItem = /^(?:[\*\-]\s*)?(?:\[([ xX])\])?\s*(.+)$/.exec(trimmed);
          if (isChecklistItem && !trimmed.startsWith('**') && !trimmed.includes('Alur Proses')) {
            const isChecked = isChecklistItem[1] ? isChecklistItem[1].toLowerCase() === 'x' : true;
            const itemText = isChecklistItem[2].trim();
            if (itemText) {
              if (parsingSection === 'fields') {
                currentPage.fields.push({ id: generateId(), text: itemText, checked: isChecked });
              } else {
                currentPage.actions.push({ id: generateId(), text: itemText, checked: isChecked });
              }
              continue;
            }
          }
        }

        // Cek baris Halaman/Tab di bawah role saat ini
        if (currentRole && (trimmed.startsWith('-') || trimmed.startsWith('*')) && !trimmed.toLowerCase().includes('alur proses')) {
          const lineWithoutBullet = trimmed.replace(/^[\-\*]\s*/, '').trim();
          const isDefault = /\(default\)/i.test(lineWithoutBullet);
          
          let pageName = lineWithoutBullet;
          const sectionList: string[] = [];

          if (lineWithoutBullet.includes(':')) {
            const [pNamePart, sectionsPart] = lineWithoutBullet.split(/:\s*(.+)/);
            pageName = pNamePart.trim();
            
            if (sectionsPart && !sectionsPart.toLowerCase().includes('field') && !sectionsPart.toLowerCase().includes('action')) {
              const rawSecs = sectionsPart.split(/,\s*/);
              for (const s of rawSecs) {
                const sClean = s.replace(/^section\s+/i, '').trim();
                if (sClean) sectionList.push(sClean);
              }
            }
          } else {
            pageName = lineWithoutBullet.replace(/\(default\)/i, '').trim();
          }

          pageName = pageName.replace(/\(default\)/i, '').trim();

          if (pageName && !forbiddenKeywords.some(k => pageName.toLowerCase().startsWith(k))) {
            const defaults = createDefaultFieldsAndActions(pageName, sectionList);
            currentPage = {
              pageName,
              isDefault,
              sections: sectionList,
              fields: defaults.fields,
              actions: defaults.actions
            };
            currentRole.pages.push(currentPage);
            parsingSection = 'none';
          }
        }
      }
    }

    const validRoles = roles.filter(r => r.pages.length > 0 || Boolean(r.alurProses));

    // Pastikan setiap page memiliki minimal fields & actions
    for (const r of validRoles) {
      for (const p of r.pages) {
        if (p.fields.length === 0 || p.actions.length === 0) {
          const defs = createDefaultFieldsAndActions(p.pageName, p.sections);
          if (p.fields.length === 0) p.fields = defs.fields;
          if (p.actions.length === 0) p.actions = defs.actions;
        }
      }
    }

    if (appName && (features.length > 0 || validRoles.length > 0)) {
      return {
        introText: introText || undefined,
        appName,
        orientation,
        visualTheme,
        features,
        roadmap,
        usp,
        roles: validRoles,
        closingQuestion: closingQuestion || undefined
      };
    }

    return null;
  } catch (err) {
    console.warn('Brief parsing fallback to raw text:', err);
    return null;
  }
}

/**
 * Serializer untuk mengonversi lembar catatan & checklist yang telah diedit
 * menjadi teks Markdown Brief Kebutuhan standar untuk AI generator.
 */
export function serializeBriefKebutuhan(data: ParsedBriefKebutuhan): string {
  const parts: string[] = [];

  parts.push('📋 **Brief Kebutuhan**\n');
  parts.push(`- **Nama App**: ${data.appName.trim()}`);
  if (data.orientation) {
    parts.push(`- **Orientasi UI**: ${data.orientation.trim()}`);
  }
  if (data.visualTheme) {
    parts.push(`- **Tema Visual**: ${data.visualTheme.trim()}`);
  }

  // Fitur Utama (Hanya yang dicentang!)
  const activeFeatures = data.features.filter(f => f.checked);
  if (activeFeatures.length > 0) {
    parts.push('\n- **Fitur Utama (V1)**:');
    activeFeatures.forEach((f, idx) => {
      parts.push(`  ${idx + 1}. ${f.text.trim()}`);
    });
  }

  // USP
  if (data.usp && data.usp.trim()) {
    parts.push(`\n- **Fitur Unik (USP)**: ${data.usp.trim()}`);
  }

  // Job Description & Struktur Halaman (Hanya role yang dipilih/aktif!)
  const activeRoles = data.roles.filter(r => r.selected);
  if (activeRoles.length > 0) {
    parts.push('\n- **Job Description & Struktur Halaman per Role**:');
    for (const r of activeRoles) {
      parts.push(`  * **${r.roleName.trim()}**:`);
      for (const p of r.pages) {
        const secText = p.sections.length > 0 ? `: section ${p.sections.join(', ')}` : '';
        const defText = p.isDefault ? ' (default)' : '';
        parts.push(`    - ${p.pageName.trim()}${defText}${secText}`);

        // Rincian Field Input aktif
        const activeFields = p.fields.filter(f => f.checked);
        if (activeFields.length > 0) {
          parts.push('      * Field Input:');
          for (const f of activeFields) {
            parts.push(`        - [x] ${f.text.trim()}`);
          }
        }

        // Rincian Action/Event aktif
        const activeActions = p.actions.filter(a => a.checked);
        if (activeActions.length > 0) {
          parts.push('      * Action / Event:');
          for (const a of activeActions) {
            parts.push(`        - [x] ${a.text.trim()}`);
          }
        }
      }

      if (r.alurProses && r.alurProses.trim()) {
        parts.push(`    - Alur Proses: ${r.alurProses.trim()}`);
      }
    }
  }

  return parts.join('\n');
}

interface BriefKebutuhanCardProps {
  data: ParsedBriefKebutuhan;
  onApplyBrief?: (compiledMarkdown: string, targetMode?: 'BUILD' | 'PLAN') => void;
}

function serializeSnapshot(
  appN: string,
  orient: string,
  theme: string,
  u: string,
  feats: ChecklistItem[],
  rls: RoleDetail[]
): string {
  return JSON.stringify({
    appName: (appN || '').trim(),
    orientation: (orient || '').trim(),
    visualTheme: (theme || '').trim(),
    usp: (u || '').trim(),
    features: feats.map(f => ({ text: f.text.trim(), checked: f.checked })),
    roles: rls.map(r => ({
      roleName: r.roleName.trim(),
      selected: r.selected,
      alurProses: (r.alurProses || '').trim(),
      pages: r.pages.map(p => ({
        pageName: p.pageName.trim(),
        isDefault: p.isDefault,
        fields: p.fields.map(f => ({ text: f.text.trim(), checked: f.checked })),
        actions: p.actions.map(a => ({ text: a.text.trim(), checked: a.checked }))
      }))
    }))
  });
}

export const BriefKebutuhanCard: React.FC<BriefKebutuhanCardProps> = ({ data, onApplyBrief }) => {
  // State interaktif lokal dari hasil parsing
  const [appName, setAppName] = useState(data.appName || 'BukuPinjam');
  const [orientation, setOrientation] = useState(data.orientation || 'Mobile-first, untuk memudahkan pengguna mengakses aplikasi melalui perangkat ponsel.');
  const [visualTheme, setVisualTheme] = useState(data.visualTheme || 'Warna cerah dan segar, dengan gaya modern yang ramah pengguna, mengedepankan kemudahan navigasi.');
  const [usp, setUsp] = useState(data.usp || '');
  const [features, setFeatures] = useState<ChecklistItem[]>(data.features || []);
  const [roles, setRoles] = useState<RoleDetail[]>(data.roles || []);

  // Snapshot awal dari AI untuk mendeteksi apakah ada perubahan (isModified)
  const [initialSnapshot, setInitialSnapshot] = useState<string>(() =>
    serializeSnapshot(data.appName, data.orientation || '', data.visualTheme || '', data.usp || '', data.features || [], data.roles || [])
  );

  // UI state
  const [newFeatureText, setNewFeatureText] = useState('');
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newRoleText, setNewRoleText] = useState('');
  const [showAddRole, setShowAddRole] = useState(false);
  const [newFieldInputs, setNewFieldInputs] = useState<Record<string, string>>({});
  const [newActionInputs, setNewActionInputs] = useState<Record<string, string>>({});
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Perbarui state jika data berubah dari luar (misal: AI selesai menyesuaikan skenario)
  useEffect(() => {
    setAppName(data.appName || 'BukuPinjam');
    if (data.orientation) setOrientation(data.orientation);
    if (data.visualTheme) setVisualTheme(data.visualTheme);
    if (data.usp) setUsp(data.usp);
    if (data.features) setFeatures(data.features);
    if (data.roles) setRoles(data.roles);

    setInitialSnapshot(
      serializeSnapshot(data.appName, data.orientation || '', data.visualTheme || '', data.usp || '', data.features || [], data.roles || [])
    );
  }, [data]);

  // Evaluasi apakah user telah melakukan modifikasi terhadap brief/role
  const currentSnapshot = serializeSnapshot(appName, orientation, visualTheme, usp, features, roles);
  const isModified = initialSnapshot !== '' && currentSnapshot !== initialSnapshot;

  // Handler: Toggle Role Selection
  const toggleRoleSelection = (index: number) => {
    setRoles(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r));
  };

  // Handler: Tambah Peran Baru
  const handleAddCustomRole = () => {
    const trimmed = newRoleText.trim();
    if (!trimmed) return;
    const defs = createDefaultFieldsAndActions('Halaman Utama', ['Form Entri', 'Daftar']);
    const newRole: RoleDetail = {
      roleName: trimmed,
      selected: true,
      pages: [
        {
          pageName: 'Workspace (default)',
          isDefault: true,
          sections: ['Form Data', 'Tabel Data'],
          fields: defs.fields,
          actions: defs.actions
        }
      ],
      alurProses: `Buka form ${trimmed} -> Masukkan data -> Simpan perubahan`
    };
    setRoles(prev => [...prev, newRole]);
    setNewRoleText('');
    setShowAddRole(false);
  };

  // Handler: Hapus Role
  const handleDeleteRole = (index: number) => {
    setRoles(prev => prev.filter((_, i) => i !== index));
  };

  // Handler: Toggle Feature
  const toggleFeature = (id: string) => {
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, checked: !f.checked } : f));
  };

  // Handler: Tambah Fitur Baru
  const handleAddFeature = () => {
    const trimmed = newFeatureText.trim();
    if (!trimmed) return;
    setFeatures(prev => [...prev, { id: generateId(), text: trimmed, checked: true }]);
    setNewFeatureText('');
    setShowAddFeature(false);
  };

  // Handler: Hapus Fitur
  const handleDeleteFeature = (id: string) => {
    setFeatures(prev => prev.filter(f => f.id !== id));
  };

  // Handler: Toggle Field
  const toggleField = (roleIndex: number, pageIndex: number, fieldId: string) => {
    setRoles(prev => prev.map((r, rIdx) => {
      if (rIdx !== roleIndex) return r;
      return {
        ...r,
        pages: r.pages.map((p, pIdx) => {
          if (pIdx !== pageIndex) return p;
          return {
            ...p,
            fields: p.fields.map(f => f.id === fieldId ? { ...f, checked: !f.checked } : f)
          };
        })
      };
    }));
  };

  // Handler: Tambah Field Baru ke Halaman
  const handleAddField = (roleIndex: number, pageIndex: number) => {
    const key = `${roleIndex}-${pageIndex}`;
    const text = (newFieldInputs[key] || '').trim();
    if (!text) return;
    setRoles(prev => prev.map((r, rIdx) => {
      if (rIdx !== roleIndex) return r;
      return {
        ...r,
        pages: r.pages.map((p, pIdx) => {
          if (pIdx !== pageIndex) return p;
          return {
            ...p,
            fields: [...p.fields, { id: generateId(), text, checked: true }]
          };
        })
      };
    }));
    setNewFieldInputs(prev => ({ ...prev, [key]: '' }));
  };

  // Handler: Hapus Field
  const handleDeleteField = (roleIndex: number, pageIndex: number, fieldId: string) => {
    setRoles(prev => prev.map((r, rIdx) => {
      if (rIdx !== roleIndex) return r;
      return {
        ...r,
        pages: r.pages.map((p, pIdx) => {
          if (pIdx !== pageIndex) return p;
          return {
            ...p,
            fields: p.fields.filter(f => f.id !== fieldId)
          };
        })
      };
    }));
  };

  // Handler: Toggle Action
  const toggleAction = (roleIndex: number, pageIndex: number, actionId: string) => {
    setRoles(prev => prev.map((r, rIdx) => {
      if (rIdx !== roleIndex) return r;
      return {
        ...r,
        pages: r.pages.map((p, pIdx) => {
          if (pIdx !== pageIndex) return p;
          return {
            ...p,
            actions: p.actions.map(a => a.id === actionId ? { ...a, checked: !a.checked } : a)
          };
        })
      };
    }));
  };

  // Handler: Tambah Action Baru
  const handleAddAction = (roleIndex: number, pageIndex: number) => {
    const key = `${roleIndex}-${pageIndex}`;
    const text = (newActionInputs[key] || '').trim();
    if (!text) return;
    const formatted = text.startsWith('onclick:') ? text : `onclick: ${text}`;
    setRoles(prev => prev.map((r, rIdx) => {
      if (rIdx !== roleIndex) return r;
      return {
        ...r,
        pages: r.pages.map((p, pIdx) => {
          if (pIdx !== pageIndex) return p;
          return {
            ...p,
            actions: [...p.actions, { id: generateId(), text: formatted, checked: true }]
          };
        })
      };
    }));
    setNewActionInputs(prev => ({ ...prev, [key]: '' }));
  };

  // Handler: Hapus Action
  const handleDeleteAction = (roleIndex: number, pageIndex: number, actionId: string) => {
    setRoles(prev => prev.map((r, rIdx) => {
      if (rIdx !== roleIndex) return r;
      return {
        ...r,
        pages: r.pages.map((p, pIdx) => {
          if (pIdx !== pageIndex) return p;
          return {
            ...p,
            actions: p.actions.filter(a => a.id !== actionId)
          };
        })
      };
    }));
  };

  // Handler: Reset ke Awal
  const handleReset = () => {
    setAppName(data.appName || 'BukuPinjam');
    if (data.orientation) setOrientation(data.orientation);
    if (data.visualTheme) setVisualTheme(data.visualTheme);
    if (data.usp) setUsp(data.usp);
    if (data.features) setFeatures(data.features);
    if (data.roles) setRoles(data.roles);
  };

  // Hitung ringkasan checklist aktif
  const currentCompiledBrief = (): string => {
    return serializeBriefKebutuhan({
      appName,
      orientation,
      visualTheme,
      usp,
      features,
      roles
    });
  };

  const activeRolesCount = roles.filter(r => r.selected).length;
  const activeFeaturesCount = features.filter(f => f.checked).length;
  const activeFieldsCount = roles
    .filter(r => r.selected)
    .reduce((acc, r) => acc + r.pages.reduce((pAcc, p) => pAcc + p.fields.filter(f => f.checked).length, 0), 0);
  const activeActionsCount = roles
    .filter(r => r.selected)
    .reduce((acc, r) => acc + r.pages.reduce((pAcc, p) => pAcc + p.actions.filter(a => a.checked).length, 0), 0);

  return (
    <div className="space-y-3.5 my-1 text-slate-200 text-xs font-sans">
      {/* 1. Teks Pengantar Percakapan */}
      {data.introText && (
        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
          {data.introText}
        </p>
      )}

      {/* 2. Container Notes & Checklist Editor */}
      <div className="rounded-2xl bg-gradient-to-b from-slate-950 to-[#0c0d14] border border-slate-800/90 p-5 space-y-4 shadow-xl relative overflow-hidden">
        {/* Glow Decorator */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header Notes Editor */}
        <div className="pb-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Notes & Checklist Editor:</span>
                <span className="text-emerald-400 font-semibold">{appName || 'Brief Kebutuhan'}</span>
              </h3>
              <p className="text-[10px] text-slate-400">
                Sesuaikan catatan, pilih peran, dan centang field & aksi yang diinginkan sebelum membuat prototipe.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {activeRolesCount} Peran • {activeFeaturesCount} Fitur • {activeFieldsCount} Field • {activeActionsCount} Aksi
            </span>
          </div>
        </div>

        {/* BAGIAN 1: EDITABLE NOTES CARD (Nama App, Orientasi UI, Tema Visual) */}
        <div className="space-y-2.5 bg-slate-900/60 rounded-xl p-3.5 border border-slate-800/80">
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Catatan Utama Aplikasi</span>
          </div>

          {/* Nama App */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300">• Nama App:</label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Contoh: BukuPinjam"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-white text-xs font-semibold focus:outline-none focus:border-emerald-400 transition-colors"
            />
          </div>

          {/* Orientasi UI */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300">• Orientasi UI:</label>
            <input
              type="text"
              value={orientation}
              onChange={(e) => setOrientation(e.target.value)}
              placeholder="Contoh: Mobile-first, untuk memudahkan pengguna mengakses melalui ponsel"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-emerald-400 transition-colors"
            />
          </div>

          {/* Tema Visual */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300">• Tema Visual:</label>
            <textarea
              rows={2}
              value={visualTheme}
              onChange={(e) => setVisualTheme(e.target.value)}
              placeholder="Contoh: Warna cerah dan segar, gaya modern ramah pengguna..."
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-emerald-400 transition-colors resize-none"
            />
          </div>

          {/* Fitur Unik (USP) */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300">• Fitur Unik (USP):</label>
            <input
              type="text"
              value={usp}
              onChange={(e) => setUsp(e.target.value)}
              placeholder="Contoh: Peminjaman instan tanpa kartu fisik, scan barcode mandiri"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 text-xs focus:outline-none focus:border-emerald-400 transition-colors"
            />
          </div>
        </div>

        {/* BAGIAN 2: KARTU PERAN YANG DAPAT DIPILIH & DIEDIT */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Aplikasi ini digunakan untuk siapa saja (Job Description):</span>
            </div>
            <span className="text-[10.5px] text-slate-400">Klik kartu untuk memilih peran</span>
          </div>

          {/* Grid Kartu Peran */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {roles.map((r, idx) => {
              const isSelected = r.selected;
              return (
                <div
                  key={idx}
                  onClick={() => toggleRoleSelection(idx)}
                  className={`relative p-2.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-950/30 border-emerald-500/60 shadow-sm shadow-emerald-500/10 text-white'
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span className={`text-xs font-bold ${isSelected ? 'text-emerald-300' : 'text-slate-400'}`}>
                        {r.roleName}
                      </span>
                    </div>

                    {roles.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(idx);
                        }}
                        className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors"
                        title="Hapus peran ini"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  <span className="text-[9.5px] text-slate-400 mt-1 block">
                    {r.pages.length} tab • {isSelected ? 'Aktif' : 'Dinonaktifkan'}
                  </span>
                </div>
              );
            })}

            {/* Kartu Tambah Peran Kustom [+] */}
            {!showAddRole ? (
              <button
                type="button"
                onClick={() => setShowAddRole(true)}
                className="p-2.5 rounded-xl border border-dashed border-slate-700 hover:border-indigo-400/70 bg-slate-900/20 hover:bg-indigo-950/20 text-slate-400 hover:text-indigo-300 transition-all flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Lain-lain (+)</span>
              </button>
            ) : (
              <div className="p-2 rounded-xl border border-indigo-500 bg-slate-900 flex items-center gap-1 col-span-2">
                <input
                  type="text"
                  value={newRoleText}
                  onChange={(e) => setNewRoleText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomRole()}
                  placeholder="Nama peran baru..."
                  className="w-full px-2 py-1 bg-slate-950 rounded text-xs text-white border border-slate-700 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCustomRole}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold shrink-0 cursor-pointer"
                >
                  Tambah
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddRole(false)}
                  className="px-1.5 py-1 text-slate-400 hover:text-white text-xs shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BAGIAN 3: CHECKLIST FITUR UTAMA (V1) */}
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-slate-200">• Fitur Utama (V1):</div>
            <span className="text-[10px] text-slate-400">Centang [x] untuk mengaktifkan di prototipe</span>
          </div>

          <div className="space-y-1.5 pl-1">
            {features.map((feat, idx) => (
              <div
                key={feat.id}
                className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-900/50 transition-colors group"
              >
                <div
                  onClick={() => toggleFeature(feat.id)}
                  className="flex items-center gap-2 cursor-pointer select-none flex-1"
                >
                  {feat.checked ? (
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  )}
                  <span className={`text-xs ${feat.checked ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                    <span className="text-slate-400 font-mono text-[11px] mr-1">{idx + 1}.</span>
                    {feat.text}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteFeature(feat.id)}
                  className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                  title="Hapus fitur"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Tambah Fitur [+] */}
            {!showAddFeature ? (
              <button
                type="button"
                onClick={() => setShowAddFeature(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:bg-indigo-950/20 rounded-lg transition-colors cursor-pointer mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Lain-lain / Tambah Fitur (+)</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 pt-1.5">
                <input
                  type="text"
                  value={newFeatureText}
                  onChange={(e) => setNewFeatureText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFeature()}
                  placeholder="Ketik fitur baru..."
                  className="flex-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold cursor-pointer"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddFeature(false)}
                  className="px-2 py-1 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BAGIAN 4: STRUKTUR HALAMAN PER ROLE (CHECKLIST FIELD INPUT & ACTION/EVENT) */}
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Job Description & Struktur Halaman per Role:</span>
            </div>
            <span className="text-[10px] text-slate-400">Centang field input & tombol aksi</span>
          </div>

          <div className="space-y-3 pl-1">
            {roles.filter(r => r.selected).map((r) => {
              const originalRoleIndex = roles.findIndex(item => item.roleName === r.roleName);
              return (
                <div
                  key={originalRoleIndex}
                  className="rounded-xl bg-slate-900/50 border border-slate-800/90 p-3.5 space-y-3"
                >
                  {/* Header Role */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-indigo-300 text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-400" />
                      * Role {r.roleName}:
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      (Peran Aktif)
                    </span>
                  </div>

                  {/* Daftar Halaman / Tab */}
                  <div className="space-y-3">
                    {r.pages.map((p, pIdx) => {
                      const inputKey = `${originalRoleIndex}-${pIdx}`;
                      return (
                        <div key={pIdx} className="space-y-2 pl-2 border-l-2 border-slate-800">
                          {/* Nama Halaman */}
                          <div className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                            <span>- {p.pageName}</span>
                            {p.isDefault && <span className="text-indigo-400 font-normal"> (default)</span>}
                            {p.sections.length > 0 && (
                              <span className="text-slate-400 font-normal">: section {p.sections.join(', ')}</span>
                            )}
                          </div>

                          {/* Checklist Field Input */}
                          <div className="bg-slate-950/70 rounded-lg p-2.5 space-y-1.5 border border-slate-800/70">
                            <div className="text-[10.5px] font-bold text-slate-300 flex items-center justify-between">
                              <span className="flex items-center gap-1 text-slate-300">
                                📝 Field Input:
                              </span>
                              <span className="text-[9.5px] text-slate-400">
                                {p.fields.filter(f => f.checked).length} terpilih
                              </span>
                            </div>

                            <div className="space-y-1 pl-1">
                              {p.fields.map(f => (
                                <div
                                  key={f.id}
                                  className="flex items-center justify-between gap-1.5 group/item hover:bg-slate-900/40 p-0.5 rounded"
                                >
                                  <div
                                    onClick={() => toggleField(originalRoleIndex, pIdx, f.id)}
                                    className="flex items-center gap-1.5 cursor-pointer select-none flex-1 text-[11px]"
                                  >
                                    {f.checked ? (
                                      <CheckSquare className="w-3 h-3 text-emerald-400 shrink-0" />
                                    ) : (
                                      <Square className="w-3 h-3 text-slate-600 shrink-0" />
                                    )}
                                    <span className={f.checked ? 'text-slate-200' : 'text-slate-500 line-through'}>
                                      {f.text}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteField(originalRoleIndex, pIdx, f.id)}
                                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100 p-0.5"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}

                              {/* Input Tambah Field Baru */}
                              <div className="flex items-center gap-1 pt-1">
                                <input
                                  type="text"
                                  value={newFieldInputs[inputKey] || ''}
                                  onChange={(e) => setNewFieldInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddField(originalRoleIndex, pIdx)}
                                  placeholder="Tambah field (contoh: No. Telepon (Number))..."
                                  className="flex-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-[10.5px] text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddField(originalRoleIndex, pIdx)}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  + Field
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Checklist Action / Event */}
                          <div className="bg-slate-950/70 rounded-lg p-2.5 space-y-1.5 border border-slate-800/70">
                            <div className="text-[10.5px] font-bold text-amber-300 flex items-center justify-between">
                              <span className="flex items-center gap-1 text-amber-300">
                                <Zap className="w-3 h-3" />
                                Action / Event (Tombol Aksi):
                              </span>
                              <span className="text-[9.5px] text-slate-400">
                                {p.actions.filter(a => a.checked).length} terpilih
                              </span>
                            </div>

                            <div className="space-y-1 pl-1">
                              {p.actions.map(a => (
                                <div
                                  key={a.id}
                                  className="flex items-center justify-between gap-1.5 group/item hover:bg-slate-900/40 p-0.5 rounded"
                                >
                                  <div
                                    onClick={() => toggleAction(originalRoleIndex, pIdx, a.id)}
                                    className="flex items-center gap-1.5 cursor-pointer select-none flex-1 text-[11px]"
                                  >
                                    {a.checked ? (
                                      <CheckSquare className="w-3 h-3 text-amber-400 shrink-0" />
                                    ) : (
                                      <Square className="w-3 h-3 text-slate-600 shrink-0" />
                                    )}
                                    <span className={a.checked ? 'text-amber-100 font-mono text-[10.5px]' : 'text-slate-500 line-through text-[10.5px]'}>
                                      {a.text}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAction(originalRoleIndex, pIdx, a.id)}
                                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100 p-0.5"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}

                              {/* Input Tambah Action Baru */}
                              <div className="flex items-center gap-1 pt-1">
                                <input
                                  type="text"
                                  value={newActionInputs[inputKey] || ''}
                                  onChange={(e) => setNewActionInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddAction(originalRoleIndex, pIdx)}
                                  placeholder="Tambah tombol (contoh: Cetak Struk Bukti)..."
                                  className="flex-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-[10.5px] text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddAction(originalRoleIndex, pIdx)}
                                  className="px-2 py-0.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/80 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  + Action
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Alur Proses */}
                    {r.alurProses && (
                      <div className="pl-2 pt-1">
                        <label className="text-[10.5px] font-semibold text-indigo-300 block mb-1">
                          - Alur Proses:
                        </label>
                        <textarea
                          rows={2}
                          value={r.alurProses}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRoles(prev => prev.map((item, idx) => idx === originalRoleIndex ? { ...item, alurProses: val } : item));
                          }}
                          className="w-full px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-400 resize-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BAGIAN 5: ACTION BUTTONS (SINKRONISASI SKENARIO & BUAT PROTOTIPE) */}
        <div className="pt-3 border-t border-slate-800 space-y-2.5">
          {/* Status Indicator Banner */}
          {isModified ? (
            <div className="w-full bg-amber-950/40 border border-amber-500/40 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-amber-200 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <span>✏️</span>
                <span>Rincian peran/fitur telah diedit. Simpan agar AI menyesuaikan skenario alur kerja terlebih dahulu.</span>
              </span>
              <span className="text-[10px] text-amber-300/80 uppercase font-mono tracking-wider font-semibold">
                Perlu Penyesuaian Skenario
              </span>
            </div>
          ) : (
            <div className="w-full bg-emerald-950/30 border border-emerald-500/30 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-emerald-300 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Skenario alur kerja & rincian peran telah diselaraskan. Siap dibuatkan prototipe!</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                ✓ Skenario Terkonfirmasi
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isModified ? 'Batal / Reset' : 'Reset'}</span>
              </button>

              {copiedNotification && (
                <span className="text-[11px] text-emerald-400 font-medium animate-fade-in">
                  ✓ Perubahan dikirim untuk disesuaikan skenarionya!
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Jika ADA perubahan: Tampilkan tombol Simpan & Sesuaikan Skenario terlebih dahulu */}
              {isModified ? (
                onApplyBrief && (
                  <button
                    type="button"
                    onClick={() => {
                      const markdown = currentCompiledBrief();
                      onApplyBrief(markdown, 'PLAN');
                      setCopiedNotification(true);
                      setTimeout(() => setCopiedNotification(false), 2500);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>💾 Simpan & Sesuaikan Skenario</span>
                  </button>
                )
              ) : (
                /* Jika SUDAH terkonfirmasi (tidak ada perubahan pending): Tampilkan tombol Buatkan Prototipe */
                onApplyBrief && (
                  <button
                    type="button"
                    onClick={() => {
                      const markdown = currentCompiledBrief();
                      onApplyBrief(markdown, 'BUILD');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-[#10f48e] hover:from-emerald-500 hover:to-[#0df28a] text-black font-extrabold text-xs shadow-lg shadow-emerald-500/25 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Rocket className="w-4 h-4 stroke-[2.5]" />
                    <span>🚀 Buatkan Prototipe</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Pertanyaan Konfirmasi Akhir */}
      {data.closingQuestion && (
        <p className="text-slate-300 leading-relaxed pt-1 whitespace-pre-wrap">
          {data.closingQuestion}
        </p>
      )}
    </div>
  );
};
