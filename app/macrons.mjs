/** @param {string} word */
export function macronKey(word) {
  return word.toLowerCase().replaceAll('v', 'u').replaceAll('j', 'i');
}

/** @param {unknown} payload @returns {Record<string, number[]>} */
export function validateMacronLexicon(payload) {
  if (!payload || typeof payload !== 'object' || !('schemaVersion' in payload) || payload.schemaVersion !== 1
    || !('entries' in payload) || !payload.entries || typeof payload.entries !== 'object' || Array.isArray(payload.entries)) {
    throw new Error('Invalid macron lexicon.');
  }
  for (const [word, positions] of Object.entries(payload.entries)) {
    if (!/^[a-z]+$/u.test(word) || macronKey(word) !== word || !Array.isArray(positions) || positions.length === 0
      || !positions.every((position, index) => Number.isInteger(position) && position >= 0
        && /[aeiouy]/u.test(word[position] ?? '') && (index === 0 || position > positions[index - 1]))) {
      throw new Error('Invalid macron position.');
    }
  }
  return /** @type {Record<string, number[]>} */ (payload.entries);
}

/** Add only supplied vowel marks; never change spelling, punctuation or spacing.
 * @param {string} text @param {Record<string, number[]> | null} entries */
export function addDictionaryMacrons(text, entries) {
  if (!entries) return text;
  return text.replace(/[\p{L}\p{M}]+/gu, (word, offset) => {
    // Preserve existing diacritics, Greek, Roman numerals and short abbreviations.
    if (!/^[A-Za-z]+$/u.test(word) || /^[IVXLCDM]+$/u.test(word)
      || (/^[A-Z]{1,3}$/u.test(word) && text[offset + word.length] === '.')) return word;
    const key = macronKey(word);
    if (!Object.hasOwn(entries, key)) return word;
    const marked = new Set(entries[key]);
    return [...word].map((letter, index) => marked.has(index) && /[aeiouy]/iu.test(letter)
      ? `${letter}\u0304`.normalize('NFC') : letter).join('');
  });
}
