import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const marker = "<!-- growing-snake -->";

export function growSnake(svg) {
  if (svg.includes(marker)) return svg;

  const duration = Number(svg.match(/\.s\{[^}]*animation:none linear (\d+)ms infinite/)?.[1]);
  const headFrames = svg.match(/@keyframes s0\{(.*?)\}\.s\.s0\{/s)?.[1] ?? "";
  const frameTimes = [...headFrames.matchAll(/([\d.]+)%/g)].map((match) => Number(match[1]));
  const uniqueTimes = [...new Set(frameTimes)].sort((a, b) => a - b);
  const step = Math.min(...uniqueTimes.slice(1).map((time, index) => time - uniqueTimes[index]).filter(Boolean));
  const eatenAt = [...svg.matchAll(/@keyframes c[0-9a-z]+\{([\d.]+)%\{/g)]
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);
  const snake = [...svg.matchAll(/<rect class="s s[0-9a-z]+"[^>]*\/>/g)];

  if (!duration || !Number.isFinite(step) || !eatenAt.length || !snake.length) {
    throw new Error("Unsupported Platane/snk SVG structure");
  }

  const tail = snake.at(-1)[0];
  const styles = eatenAt.map((time, index) => {
    const showAt = Math.max(0, time - 0.01);
    const delay = Math.round((snake.length + index) * step * duration / 100);
    return `.s.g${index}{animation-name:s0,g${index};animation-duration:${duration}ms,${duration}ms;animation-delay:${delay}ms,0ms;animation-timing-function:linear,steps(1,end);animation-iteration-count:infinite,infinite}@keyframes g${index}{0%,${showAt}%{opacity:0}${time}%,99.2%{opacity:1}99.3%,100%{opacity:0}}`;
  }).join("");
  const segments = eatenAt.map((time, index) =>
    tail.replace(/class="[^"]+"/, `class="s grow g${index}" data-grown-at="${time}%"`)
  ).join("");

  return svg
    .replace("</style>", `.s.grow{opacity:0}${styles}</style>`)
    .replace("</svg>", `${marker}${segments}</svg>`);
}

async function selfTest() {
  const sample = '<svg><style>.s{animation:none linear 10000ms infinite}@keyframes c0{10%{x:0}}@keyframes c1{30%{x:0}}@keyframes s0{0%{x:0}5%{x:1}10%{x:2}}.s.s0{animation-name:s0}</style><rect class="s s0" x="0"/><rect class="s s1" x="1"/></svg>';
  const result = growSnake(sample);
  assert.equal((result.match(/class="s grow/g) ?? []).length, 2);
  assert.match(result, /data-grown-at="10%"/);
  assert.equal(growSnake(result), result);
  console.log("grow-snake self-test passed");
}

if (process.argv[2] === "--self-test") {
  await selfTest();
} else {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("Pass at least one SVG path");
  for (const file of files) {
    await writeFile(file, growSnake(await readFile(file, "utf8")));
  }
}
