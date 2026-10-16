const MAP: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', c: 'ç', n: 'ñ', C: 'Ç', N: 'Ñ', y: 'ý', Y: 'Ý'
};

/**
 * Pseudo-localisation: accents every vowel, pads by 30% with "~" and wraps in ⟦…⟧, leaving {placeholders} intact.
 * Used to find hard-coded strings (anything still in plain ASCII letters) and layouts that cannot take longer text.
 */
export function pseudo(s: string): string {
  const mapped = s.split(/(\{\w+\})/).map(part => (/^\{\w+\}$/.test(part) ? part : part.replace(/[A-Za-z]/g, c => MAP[c] ?? c))).join('');
  const pad = '~'.repeat(Math.ceil(s.length * 0.3));
  return `⟦${mapped}${pad}⟧`;
}
