function testSectionRegex(text: string) {
  const sectionRegex = /(?:^|\n)(?:#{1,6}\s*)?(?:\*\*)?(?:Bagian\s+|Poin\s+)?(\d+)[\.\)]\s*(?:\*\*)?\s*([^\n]+)\n([\s\S]*?)(?=(?:\n(?:#{1,6}\s*)?(?:\*\*)?(?:Bagian\s+|Poin\s+)?\d+[\.\)]\s*)|$)/gi;
  const sections: { num: number; title: string; content: string }[] = [];
  let match;
  while ((match = sectionRegex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    const title = match[2].replace(/[*_#`:]/g, '').trim();
    const content = match[3].trim();
    sections.push({ num, title, content });
  }
  return sections;
}

const samples = [
  {
    name: 'Plain 1. 2.',
    text: `
1. Executive Summary
Ringkasan...
2. Peran Pengguna
Roles...
`
  },
  {
    name: 'Bold **1. Title**',
    text: `
**1. Executive Summary & Core Purpose**
Ronda Pintar adalah...

**2. Peran Pengguna & Hak Akses (User Roles & Login)**
Admin dan Petugas.
`
  },
  {
    name: 'Markdown Header ### 1. Title',
    text: `
### 1. Executive Summary & Core Purpose
Isi 1...

### 2. Peran Pengguna
Isi 2...
`
  },
  {
    name: 'Markdown Header ### **1. Title**',
    text: `
### **1. Executive Summary**
Isi 1...

### **2. Peran Pengguna**
Isi 2...
`
  },
  {
    name: 'Parenthesis 1) 2)',
    text: `
1) Executive Summary
Isi 1...
2) Peran Pengguna
Isi 2...
`
  }
];

for (const s of samples) {
  const res = testSectionRegex(s.text);
  console.log(`${s.name}: ${res.length} sections found`);
}
