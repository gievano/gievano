import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

export function makeMonochrome(svg, mode) {
  if (!['light', 'dark'].includes(mode)) throw new Error('Mode must be light or dark');

  const colors = [...new Set([...svg.matchAll(/<rect(?=[^>]*class="gpsc-item")[^>]*fill="(#[\da-f]{6})"/gi)].map((match) => match[1]))];
  if (!colors.length) throw new Error('No language colors found');

  const [start, end] = mode === 'dark' ? [255, 96] : [17, 190];
  return colors.reduce((result, color, index) => {
    const value = Math.round(start + (end - start) * index / Math.max(1, colors.length - 1));
    const gray = `#${value.toString(16).padStart(2, '0').repeat(3)}`;
    return result.replace(new RegExp(color, 'gi'), gray);
  }, svg);
}

async function selfTest() {
  const sample = '<svg><rect fill="#0D1117"/><rect class="gpsc-item" fill="#e34c26"/><rect class="gpsc-item" fill="#00A2FF"/><path style="fill: #e34c26"/></svg>';
  const result = makeMonochrome(sample, 'dark');
  assert.match(result, /fill="#0D1117"/);
  assert.doesNotMatch(result, /#e34c26|#00A2FF/i);
  assert.match(result, /fill: #ffffff/i);
  console.log('mono-language-card self-test passed');
}

if (process.argv[2] === '--self-test') {
  await selfTest();
} else {
  const [mode, ...files] = process.argv.slice(2);
  if (!files.length) throw new Error('Usage: node scripts/mono-language-card.mjs light|dark file.svg');
  for (const file of files) await writeFile(file, makeMonochrome(await readFile(file, 'utf8'), mode));
}
