import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const THEMES = {
  light: {
    bg: "#FFFFFF",
    border: "#D0D0D0",
    title: "#111111",
    muted: "#555555",
    empty: "#EBEDF0",
    levels: ["#EBEDF0", "#D0D0D0", "#8C8C8C", "#444444", "#111111"],
  },
  dark: {
    bg: "#0D1117",
    border: "#3D444D",
    title: "#FFFFFF",
    muted: "#AAAAAA",
    empty: "#161B22",
    levels: ["#161B22", "#3A3A3A", "#6E6E6E", "#A8A8A8", "#FFFFFF"],
  },
};

const CELL = 12;
const GAP = 3;
const PITCH = CELL + GAP;
const ROWS = 7;
const COLS = 53;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const escape = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Accepts either the GitHub GraphQL contributionsCollection payload or the
// flat { contributions: [{ date, count, level }] } shape.
export function normalizeDays(payload) {
  const weeks = payload?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (Array.isArray(weeks)) {
    return weeks.flatMap((week) =>
      (week.contributionDays ?? []).map((day) => ({
        date: day.date,
        count: Number(day.contributionCount) || 0,
        level: LEVELS[day.contributionLevel] ?? 0,
      }))
    );
  }
  if (Array.isArray(payload?.contributions)) return payload.contributions;
  throw new Error("Unrecognised contributions payload");
}

export function renderContributionGraph(days, mode) {
  const theme = THEMES[mode];
  if (!theme) throw new Error("Mode must be light or dark");
  if (!Array.isArray(days) || !days.length) throw new Error("No contribution days supplied");

  const parsed = days
    .map((day) => ({ date: new Date(`${day.date}T00:00:00Z`), count: Number(day.count) || 0, level: Number(day.level) || 0 }))
    .sort((a, b) => a.date - b.date);

  // GitHub grids run Sunday -> Saturday; pad both ends to whole weeks.
  const first = new Date(parsed[0].date);
  first.setUTCDate(first.getUTCDate() - first.getUTCDay());
  const last = new Date(parsed.at(-1).date);
  last.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));

  const byDate = new Map(parsed.map((day) => [day.date.toISOString().slice(0, 10), day]));
  const weeks = Math.max(COLS, Math.round((last - first) / 604800000) + 1);
  const total = parsed.reduce((sum, day) => sum + day.count, 0);

  const titleY = 18;
  const monthY = 40;
  const gridY = 48;
  const gridW = (weeks - 1) * PITCH + CELL;
  const gridH = (ROWS - 1) * PITCH + CELL;
  const width = gridW;
  const height = gridY + gridH + 34;

  const cells = [];
  const monthLabels = [];
  let seenMonth = -1;

  for (let week = 0; week < weeks; week += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      const date = new Date(first);
      date.setUTCDate(date.getUTCDate() + week * 7 + row);
      if (date > last) continue;

      const key = date.toISOString().slice(0, 10);
      const day = byDate.get(key) ?? { count: 0, level: 0 };
      const level = Math.min(4, Math.max(0, day.level));
      const x = week * PITCH;
      const y = gridY + row * PITCH;

      cells.push(
        `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${theme.levels[level]}">` +
          `<title>${escape(key)}: ${day.count} contribution${day.count === 1 ? "" : "s"}</title></rect>`
      );

      if (row === 0 && date.getUTCMonth() !== seenMonth) {
        seenMonth = date.getUTCMonth();
        monthLabels.push(
          `<text x="${x}" y="${monthY}" fill="${theme.muted}" font-size="10">${MONTHS[seenMonth]}</text>`
        );
      }
    }
  }

  const legendX = width - 5 * PITCH - 34;
  const legendY = gridY + gridH + 18;
  const legend = ["less", "more"].map((label, index) => {
    const x = legendX + (index === 0 ? 0 : 5 * PITCH + 6);
    return `<text x="${x}" y="${legendY + 10}" fill="${theme.muted}" font-size="10" text-anchor="${index === 0 ? "end" : "start"}">${label}</text>`;
  });

  const legendCells = theme.levels
    .map(
      (fill, index) =>
        `<rect x="${legendX + 6 + index * PITCH}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}" />`
    )
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gievano's contribution graph">`,
    `<style>text{font-family:'Fira Code','Segoe UI',Ubuntu,sans-serif;font-weight:500}</style>`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="6" fill="${theme.bg}" stroke="${theme.border}" />`,
    `<text x="0" y="${titleY}" fill="${theme.title}" font-size="14">contributions</text>`,
    `<text x="${width}" y="${titleY}" fill="${theme.muted}" font-size="11" text-anchor="end">${total} in the last year</text>`,
    monthLabels.join(""),
    cells.join(""),
    legend.join(""),
    legendCells,
    "</svg>",
  ].join("");
}

async function selfTest() {
  const days = Array.from({ length: 371 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 8, 14 + index));
    return { date: date.toISOString().slice(0, 10), count: index % 5, level: index % 5 };
  });
  const light = renderContributionGraph(days, "light");
  const dark = renderContributionGraph(days, "dark");

  assert.match(light, /^<svg /);
  assert.match(light, /fill="#FFFFFF"/);
  assert.match(dark, /fill="#0D1117"/);
  assert.doesNotMatch(light, /github-readme-activity-graph/);
  assert.equal((light.match(/<rect /g) ?? []).length, 371 + 5 + 1);
  assert.throws(() => renderContributionGraph([], "light"), /No contribution days/);
  assert.throws(() => renderContributionGraph(days, "neon"), /light or dark/);

  const graphql = {
    data: {
      user: {
        contributionsCollection: {
          contributionCalendar: {
            weeks: [
              { contributionDays: [{ date: "2026-01-04", contributionCount: 3, contributionLevel: "THIRD_QUARTILE" }] },
            ],
          },
        },
      },
    },
  };
  assert.deepEqual(normalizeDays(graphql), [{ date: "2026-01-04", count: 3, level: 3 }]);
  assert.deepEqual(normalizeDays({ contributions: [{ date: "2026-01-04", count: 1, level: 1 }] }), [
    { date: "2026-01-04", count: 1, level: 1 },
  ]);
  assert.throws(() => normalizeDays({ nope: true }), /Unrecognised/);

  console.log("contribution-graph self-test passed");
}

if (process.argv[2] === "--self-test") {
  await selfTest();
} else {
  const [mode, input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Usage: node scripts/contribution-graph.mjs light|dark input.json output.svg");
  const payload = JSON.parse(await readFile(input, "utf8"));
  await writeFile(output, renderContributionGraph(normalizeDays(payload), mode));
}
