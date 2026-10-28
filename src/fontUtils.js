export const FONT_OPTIONS = [
  { id: '', label: 'Default Font', family: '', group: 'General' },
  // Urdu & Arabic Fonts
  { id: 'nastaleeq', label: 'Jameel Noori Nastaleeq (نستعلیق)', family: "'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif", group: 'Urdu / Arabic' },
  { id: 'noto-nastaliq', label: 'Noto Nastaliq Urdu (نستعلیق اردو)', family: "'Noto Nastaliq Urdu', serif", group: 'Urdu / Arabic' },
  { id: 'gulzar', label: 'Gulzar (گلزار - خط نستعلیق)', family: "'Gulzar', serif", group: 'Urdu / Arabic' },
  { id: 'lateef', label: 'Lateef (لطیف - نسخ)', family: "'Lateef', serif", group: 'Urdu / Arabic' },
  { id: 'scheherazade', label: 'Scheherazade New (شهرزاد)', family: "'Scheherazade New', serif", group: 'Urdu / Arabic' },
  { id: 'harmattan', label: 'Harmattan (هرمتان)', family: "'Harmattan', sans-serif", group: 'Urdu / Arabic' },
  { id: 'reem-kufi', label: 'Reem Kufi (ريم كوفي)', family: "'Reem Kufi', sans-serif", group: 'Urdu / Arabic' },
  { id: 'marhey', label: 'Marhey (مرحي - عصري)', family: "'Marhey', cursive", group: 'Urdu / Arabic' },
  { id: 'cairo', label: 'Cairo (كايرو - حديث)', family: "'Cairo', sans-serif", group: 'Urdu / Arabic' },
  { id: 'amiri', label: 'Amiri (أميري - كلاسيكي)', family: "'Amiri', serif", group: 'Urdu / Arabic' },
  { id: 'tajawal', label: 'Tajawal (تجوال - هندسي)', family: "'Tajawal', sans-serif", group: 'Urdu / Arabic' },
  { id: 'almarai', label: 'Almarai (المرعي - واضح)', family: "'Almarai', sans-serif", group: 'Urdu / Arabic' },
  // English Fonts
  { id: 'inter', label: 'Inter (Clean Sans)', family: "'Inter', sans-serif", group: 'English' },
  { id: 'roboto', label: 'Roboto (Modern Sans)', family: "'Roboto', sans-serif", group: 'English' },
  { id: 'poppins', label: 'Poppins (Geometric Sans)', family: "'Poppins', sans-serif", group: 'English' },
  { id: 'outfit', label: 'Outfit (Modern Display)', family: "'Outfit', sans-serif", group: 'English' },
  { id: 'merriweather', label: 'Merriweather (Readability Serif)', family: "'Merriweather', Georgia, serif", group: 'English' },
  { id: 'lora', label: 'Lora (Editorial Serif)', family: "'Lora', Georgia, serif", group: 'English' },
  { id: 'playfair', label: 'Playfair Display (Classical Serif)', family: "'Playfair Display', Georgia, serif", group: 'English' },
  { id: 'cinzel', label: 'Cinzel (Classical Elegant)', family: "'Cinzel', Georgia, serif", group: 'English' },
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
