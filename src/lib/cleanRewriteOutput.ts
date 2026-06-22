/**
 * Bersihkan keluaran AI rewrite agar hanya teks naskah murni yang tersisa.
 *
 * Meski prompt sudah meminta "Return ONLY rewritten text", model kerap tetap
 * menambahkan pengantar ("Berikut versi yang sudah diperbaiki:"), meng-echo label
 * dari template prompt ("Rewritten:"), membungkus hasil dalam code fence, atau
 * menyelubunginya dengan tanda kutip. Fungsi ini membuang artefak-artefak itu
 * secara konservatif — tanpa merusak naskah yang sah (mis. dialog ber-kutip).
 */
export function cleanRewriteOutput(raw: string): string {
  if (!raw) return '';
  let text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return '';

  // 1. Buang code fence pembungkus penuh: ```lang \n ... \n ```
  const fence = text.match(/^```[^\n]*\n([\s\S]*?)\n?```$/);
  if (fence) text = fence[1].trim();

  // 2. Buang baris label / pengantar di awal. Diulang karena bisa bertumpuk
  //    (mis. kalimat pengantar diikuti label "Rewritten:").
  const leadingPatterns: RegExp[] = [
    // Echo label dari template prompt
    /^(?:rewritten|hasil(?:\s+tenun[a-z]*)?|output|result|revisi|versi\s+baru)\s*:\s*\n+/i,
    // Kalimat pengantar yang diakhiri titik dua (dibatasi panjang agar tak
    // memakan kalimat naskah yang kebetulan diakhiri ":")
    /^(?:berikut|ini(?:lah)?|here(?:'s| is| are)?|sure|tentu(?:\s+saja)?|baik(?:lah)?|oke?|certainly)[^\n:]{0,80}:\s*\n+/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of leadingPatterns) {
      const next = text.replace(re, '');
      if (next !== text) {
        text = next.trimStart();
        changed = true;
      }
    }
  }

  // 3. Buang tanda kutip pembungkus penuh — HANYA bila karakter kutip itu tak
  //    muncul lagi di tengah, supaya dialog ber-kutip tidak ikut terpotong.
  const quotePairs: [string, string][] = [
    ['"', '"'],
    ['“', '”'], // “ ”
    ["'", "'"],
    ['‘', '’'], // ‘ ’
    ['«', '»'], // « »
  ];
  for (const [open, close] of quotePairs) {
    if (text.length >= open.length + close.length && text.startsWith(open) && text.endsWith(close)) {
      const inner = text.slice(open.length, text.length - close.length);
      if (!inner.includes(open) && !inner.includes(close)) {
        text = inner.trim();
        break;
      }
    }
  }

  return text.trim();
}
