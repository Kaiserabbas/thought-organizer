export const FONT_OPTIONS = [
  { id: '', label: 'Default Font', family: '', group: 'General' },
  // Arabic Fonts
  { id: 'cairo', label: 'Cairo (كايرو - حديث)', family: "'Cairo', sans-serif", group: 'Arabic' },
  { id: 'amiri', label: 'Amiri (أميري - كلاسيكي)', family: "'Amiri', serif", group: 'Arabic' },
  { id: 'tajawal', label: 'Tajawal (تجوال - هندسي)', family: "'Tajawal', sans-serif", group: 'Arabic' },
  { id: 'almarai', label: 'Almarai (المرعي - واضح)', family: "'Almarai', sans-serif", group: 'Arabic' },
  { id: 'nastaleeq', label: 'Nastaleeq (نستعلیق)', family: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif", group: 'Arabic' },
  // English Fonts
  { id: 'inter', label: 'Inter (Clean Sans)', family: "'Inter', sans-serif", group: 'English' },
  { id: 'playfair', label: 'Playfair Display (Serif)', family: "'Playfair Display', Georgia, serif", group: 'English' },
  { id: 'lora', label: 'Lora (Editorial Serif)', family: "'Lora', Georgia, serif", group: 'English' },
  { id: 'outfit', label: 'Outfit (Modern Sans)', family: "'Outfit', sans-serif", group: 'English' },
  { id: 'jetbrains', label: 'JetBrains Mono (Monospace)', family: "'JetBrains Mono', monospace", group: 'English' },
];

export function getFontFamilyCss(fontId) {
  if (!fontId) return undefined;
  const match = FONT_OPTIONS.find(
    (f) => f.id.toLowerCase() === String(fontId).toLowerCase() || f.label === fontId || f.family === fontId
  );
  if (match && match.family) return match.family;
  if (
    fontId.includes(',') ||
    fontId.includes('sans') ||
    fontId.includes('serif') ||
    fontId.includes('mono')
  ) {
    return fontId;
  }
  return undefined;
}

export function getCategoriesByUsage(categoriesList = [], thoughtsList = []) {
  const usageMap = {};
  (thoughtsList || []).forEach((t) => {
    if (t?.category) {
      usageMap[t.category] = (usageMap[t.category] || 0) + 1;
    }
  });

  return [...(categoriesList || [])].sort((a, b) => {
    const countA = usageMap[a] || 0;
    const countB = usageMap[b] || 0;
    if (countB !== countA) {
      return countB - countA; // Most used category on top
    }
    const indexA = categoriesList.indexOf(a);
    const indexB = categoriesList.indexOf(b);
    return indexA - indexB;
  });
}
