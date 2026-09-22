import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function runGit(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

const repo = process.env.GITHUB_REPOSITORY || "heisdezz/d-stream";
const runNumber = process.env.GITHUB_RUN_NUMBER || "local";
const commitSha = process.env.GITHUB_SHA || runGit("git rev-parse HEAD");
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"),
);
const version = packageJson.version || "1.0.0";

// Determine commit range
let revRange = "";
const prevTag = runGit("git describe --tags --abbrev=0 HEAD~1 2>/dev/null");
if (prevTag) {
  revRange = `${prevTag}..HEAD`;
} else {
  // If no previous tag, take last 25 commits or all
  const commitCount = parseInt(runGit("git rev-list --count HEAD") || "0", 10);
  if (commitCount > 25) {
    revRange = "HEAD~25..HEAD";
  } else {
    revRange = "HEAD";
  }
}

const rawLog = runGit(`git log ${revRange} --pretty=format:"%h|%s|%an"`);
const lines = rawLog ? rawLog.split("\n").filter(Boolean) : [];

const categories = {
  features: { title: "🚀 Features", items: [] },
  fixes: { title: "🐛 Bug Fixes", items: [] },
  performance: { title: "⚡ Performance & Refactoring", items: [] },
  ui: { title: "🎨 UI & Styling", items: [] },
  build: { title: "🔧 Build, CI & Maintenance", items: [] },
  other: { title: "📦 Other Changes", items: [] },
};

lines.forEach((line) => {
  const parts = line.split("|");
  if (parts.length < 3) return;
  const [hash, rawMsg, author] = parts;
  const msg = rawMsg.trim();
  const lower = msg.toLowerCase();

  // Categorize
  let target = categories.other;
  if (/^feat(\(.*?\))?:/i.test(lower)) {
    target = categories.features;
  } else if (/^(fix|bugfix)(\(.*?\))?:/i.test(lower) || lower.startsWith("fixed ")) {
    target = categories.fixes;
  } else if (/^(perf|refactor)(\(.*?\))?:/i.test(lower)) {
    target = categories.performance;
  } else if (/^(ui|style)(\(.*?\))?:/i.test(lower)) {
    target = categories.ui;
  } else if (/^(ci|build|chore)(\(.*?\))?:/i.test(lower)) {
    target = categories.build;
  }

  const commitUrl = `https://github.com/${repo}/commit/${hash}`;
  target.items.push(
    `- **${msg}** ([${hash}](${commitUrl})) - @${author}`,
  );
});

// Construct release notes markdown
let output = `## 📱 d-stream Android Release v${version} (Build #${runNumber})\n\n`;
output += `**Full Commit:** [\`${commitSha.slice(0, 7)}\`](https://github.com/${repo}/commit/${commitSha})\n\n`;

let hasEntries = false;
Object.values(categories).forEach(({ title, items }) => {
  if (items.length > 0) {
    hasEntries = true;
    output += `### ${title}\n\n`;
    items.forEach((item) => {
      output += `${item}\n`;
    });
    output += "\n";
  }
});

if (!hasEntries) {
  output += "### 📦 Changes\n- Release build update.\n\n";
}

output += "---\n";
output += "### ⬇️ Downloads & Installation\n";
output += "- **Android APK**: Download `d-stream-release.apk` attached below.\n";
output += "- Install directly onto your Android device (ensure *Install from Unknown Sources* is enabled for your file manager).\n";

const outDir = path.resolve(process.cwd(), "build-output");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, "RELEASE_NOTES.md"), output, "utf-8");
console.log("Release notes generated at build-output/RELEASE_NOTES.md");
