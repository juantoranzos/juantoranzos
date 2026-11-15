// Generates a dark contribution calendar SVG from the GitHub GraphQL API.
// Usage: GITHUB_TOKEN=... node contribution-graph.mjs <username> <output.svg>
import { writeFile } from "node:fs/promises";

const [username, output = "contribution-graph.svg"] = process.argv.slice(2);
const token = process.env.GITHUB_TOKEN;

if (!username || !token) {
  console.error("Usage: GITHUB_TOKEN=... node contribution-graph.mjs <username> [output.svg]");
  process.exit(1);
}

const theme = {
  background: "#1a1b27",
  text: "#8b949e",
  title: "#70a5fd",
  levels: ["#2a2e3d", "#0e4429", "#006d32", "#26a641", "#39d353"],
};

const LEVEL_INDEX = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date contributionCount contributionLevel weekday }
        }
      }
    }
  }
}`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: username } }),
  signal: AbortSignal.timeout(30_000),
});

const payload = await response.json();
if (!response.ok || payload.errors || !payload.data?.user) {
  console.error(JSON.stringify(payload.errors ?? payload, null, 2));
  process.exit(1);
}

const { totalContributions, weeks } = payload.data.user.contributionsCollection.contributionCalendar;

const cell = 11;
const gap = 3;
const step = cell + gap;
const left = 36;
const top = 48;
const width = left + weeks.length * step + 16;
const height = top + 7 * step + 16;

const escape = (value) => String(value).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const cells = [];
const monthLabels = [];
let lastMonth = -1;

weeks.forEach((week, x) => {
  const firstDay = week.contributionDays[0];
  const month = Number(firstDay.date.slice(5, 7)) - 1;
  if (month !== lastMonth && x < weeks.length - 2) {
    monthLabels.push(`<text x="${left + x * step}" y="${top - 8}">${MONTHS[month]}</text>`);
    lastMonth = month;
  }

  for (const day of week.contributionDays) {
    const fill = theme.levels[LEVEL_INDEX[day.contributionLevel] ?? 0];
    const label = `${day.contributionCount} contributions on ${day.date}`;
    cells.push(
      `<rect x="${left + x * step}" y="${top + day.weekday * step}" width="${cell}" height="${cell}" rx="2" fill="${fill}"><title>${escape(label)}</title></rect>`,
    );
  }
});

const dayLabels = [
  [1, "Mon"],
  [3, "Wed"],
  [5, "Fri"],
].map(([row, name]) => `<text x="4" y="${top + row * step + cell - 2}">${name}</text>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${totalContributions} contributions in the last year">
<rect width="100%" height="100%" rx="6" fill="${theme.background}"/>
<g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="10" fill="${theme.text}">
<text x="${left}" y="20" font-size="13" font-weight="600" fill="${theme.title}">${totalContributions} contributions in the last year</text>
${monthLabels.join("\n")}
${dayLabels.join("\n")}
</g>
${cells.join("\n")}
</svg>
`;

await writeFile(output, svg);
console.log(`Wrote ${output} (${totalContributions} contributions)`);
