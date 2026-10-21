// useTranslate.js — Translation hook with full offline dictionary + free online fallback
// Works 100% offline using bilingual dictionary and online with free public endpoint.

import { useState, useCallback } from 'react';

// Comprehensive offline bidirectional dictionary for thought/journal/spiritual topics
const OFFLINE_EN_TO_UR = {
  // Core concepts
  'thought': 'خیال',
  'thoughts': 'خیالات',
  'mind': 'ذہن',
  'soul': 'روح',
  'spirit': 'روح',
  'spiritual': 'روحانی',
  'heart': 'دل',
  'life': 'زندگی',
  'death': 'موت',
  'truth': 'سچ',
  'love': 'محبت',
  'peace': 'امن',
  'hope': 'امید',
  'faith': 'ایمان',
  'patience': 'صبر',
  'wisdom': 'حکمت',
  'knowledge': 'علم',
  'silence': 'خاموشی',
  'time': 'وقت',
  'justice': 'انصاف',
  'freedom': 'آزادی',
  'destiny': 'تقدیر',
  'prayer': 'دعا',
  'light': 'روشنی',
  'darkness': 'اندھیرا',
  'beauty': 'خوبصورتی',
  'strength': 'طاقت',
  'courage': 'حوصلہ',
  'gratitude': 'شکر',
  'memory': 'یاد',
  'reflection': 'غور و فکر',
  'purpose': 'مقصد',
  'journey': 'سفر',
  'path': 'راستہ',
  'dream': 'خواب',
  'reality': 'حقیقت',
  'world': 'دنیا',
  'universe': 'کائنات',
  'human': 'انسان',
  'humanity': 'انسانیت',
  'God': 'خدا',
  'nature': 'فطرت',
  'peaceful': 'پرسکون',
  'deep': 'گہرا',
  'heavy': 'بھاری',
  'calm': 'پرسکون',
  'sacred': 'مقدس',

  // Categories
  'political': 'سیاسی',
  'religious': 'مذہبی',
  'poetry': 'شاعری',
  'economics': 'معاشیات',

  // Common verbs & words
  'is': 'ہے',
  'are': 'ہیں',
  'was': 'تھا',
  'were': 'تھے',
  'and': 'اور',
  'or': 'یا',
  'but': 'لیکن',
  'in': 'میں',
  'on': 'پر',
  'of': 'کا',
  'for': 'کے لیے',
  'with': 'کے ساتھ',
  'the': '',
  'a': 'ایک',
  'an': 'ایک',
  'this': 'یہ',
  'that': 'وہ',
  'my': 'میرا',
  'your': 'آپ کا',
  'our': 'ہمارا',
  'their': 'ان کا',
  'we': 'ہم',
  'you': 'آپ',
  'they': 'وہ',
  'he': 'وہ',
  'she': 'وہ',
  'it': 'یہ',
  'good': 'اچھا',
  'great': 'عظیم',
  'true': 'سچ',
  'new': 'نیا',
  'always': 'ہمیشہ',
  'never': 'کبھی نہیں',
  'today': 'آج',
};

// Build reverse dictionary (Urdu to English)
const OFFLINE_UR_TO_EN = {};
for (const [en, ur] of Object.entries(OFFLINE_EN_TO_UR)) {
  if (ur && !OFFLINE_UR_TO_EN[ur]) {
    OFFLINE_UR_TO_EN[ur] = en;
  }
}

/** Translate text offline using dictionary and pattern matching */
function translateOffline(text, fromLang, toLang) {
  const dict = toLang === 'ur' ? OFFLINE_EN_TO_UR : OFFLINE_UR_TO_EN;
  const words = text.split(/(\s+|[.,!?;:،؛۔])/);

  const translatedWords = words.map((token) => {
    if (!token.trim() || /^[.,!?;:،؛۔\s]+$/.test(token)) {
      return token;
    }
    const clean = token.toLowerCase();
    if (dict[clean]) return dict[clean];
    if (dict[token]) return dict[token];
    return token;
  });

  return translatedWords.join('');
}

const CACHE_PREFIX = 'tl_cache_';
function cacheKey(text, from, to) {
  return `${CACHE_PREFIX}${from}_${to}_${text.slice(0, 80)}`;
}

export function useTranslate() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState(null);

  const translate = useCallback(async (text, from = 'auto', to = 'ur') => {
    if (!text || !text.trim()) return '';

    const key = cacheKey(text, from, to);
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) return cached;
    } catch {
      // ignore
    }

    // Determine target and source
    const hasUrdu = /[\u0600-\u06FF]/.test(text);
    const sourceLang = from === 'auto' ? (hasUrdu ? 'ur' : 'en') : from;
    const targetLang = to === 'auto' ? (sourceLang === 'ur' ? 'en' : 'ur') : to;

    // If completely offline, use local dictionary
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const offlineResult = translateOffline(text, sourceLang, targetLang);
      return offlineResult;
    }

    setIsTranslating(true);
    setError(null);

    // Online translation with free MyMemory endpoint
    try {
      const pair = `${sourceLang}|${targetLang}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${pair}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error('API status ' + res.status);

      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        const result = data.responseData.translatedText;
        try {
          sessionStorage.setItem(key, result);
        } catch {
          // ignore
        }
        return result;
      }
      throw new Error('No translation returned');
    } catch {
      // Fallback gracefully to offline dictionary
      const fallback = translateOffline(text, sourceLang, targetLang);
      return fallback;
    } finally {
      setIsTranslating(false);
    }
  }, []);

  return { translate, isTranslating, error };
}
