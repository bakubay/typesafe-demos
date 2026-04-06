import type { SessionStats } from "./stats";

interface Theme {
  fg(style: string, text: string): string;
  bold(text: string): string;
}

const MOOD_FACES: [number, string, string][] = [
  [0,   "😶", "no data"],
  [1.5, "😌", "calm"],
  [2.5, "😐", "neutral"],
  [3.5, "😤", "tense"],
  [5.1, "🤬", "frustrated"],
];

const HELP_FACES: [number, string][] = [
  [0,   "💀"],
  [1.5, "😬"],
  [2.5, "🤷"],
  [3.5, "👍"],
  [5.1, "🔥"],
];

function getMoodFace(frustration: number): { emoji: string; label: string } {
  if (frustration === 0) return { emoji: MOOD_FACES[0][1], label: MOOD_FACES[0][2] };
  for (let i = 1; i < MOOD_FACES.length; i++) {
    if (frustration < MOOD_FACES[i][0]) {
      return { emoji: MOOD_FACES[i][1], label: MOOD_FACES[i][2] };
    }
  }
  return { emoji: "🤬", label: "frustrated" };
}

function getHelpFace(helpfulness: number): string {
  if (helpfulness === 0) return HELP_FACES[0][1];
  for (let i = 1; i < HELP_FACES.length; i++) {
    if (helpfulness < HELP_FACES[i][0]) {
      return HELP_FACES[i][1];
    }
  }
  return "🔥";
}

function sparkline(values: number[], max: number): string {
  const blocks = " ▁▂▃▄▅▆▇█";
  return values
    .map((v) => {
      const idx = Math.round((Math.min(v, max) / max) * (blocks.length - 1));
      return blocks[idx];
    })
    .join("");
}

export function getMoodIndicator(frustrationAvg: number, theme: Theme): string {
  const { emoji, label } = getMoodFace(frustrationAvg);
  if (frustrationAvg === 0) return theme.fg("dim", `${emoji} -- no data`);
  if (frustrationAvg < 1.5) return theme.fg("success", `${emoji} ${label}`);
  if (frustrationAvg < 2.5) return theme.fg("dim", `${emoji} ${label}`);
  if (frustrationAvg < 3.5) return theme.fg("warning", `${emoji} ${label}`);
  return theme.fg("error", `${emoji} ${label}`);
}

export function formatStatusLine(stats: SessionStats, theme: Theme): string {
  const avg = stats.getFrustrationMovingAverage();
  const mood = getMoodIndicator(avg, theme);
  const turns = theme.fg("dim", `${stats.turnCount} turns`);
  const avgText = avg > 0 ? theme.fg("dim", `avg ${avg.toFixed(1)}`) : "";

  return [mood, turns, avgText].filter(Boolean).join(theme.fg("dim", " | "));
}

export function formatMoodReport(stats: SessionStats): string[] {
  const lines: string[] = [];
  const userRecords = stats.getUserRecords();
  const assistantRecords = stats.getAssistantRecords();
  const trajectory = stats.getMoodTrajectory();

  const frustAvg = stats.getFrustrationMovingAverage(999);
  const { emoji } = getMoodFace(frustAvg);
  lines.push(`╔══════════════════════════════════════════╗`);
  lines.push(`║   ${emoji}  Session Mood Report  ${emoji}              ║`);
  lines.push(`╚══════════════════════════════════════════╝`);
  lines.push("");

  const elapsed = Math.round((Date.now() - stats.startTime) / 60000);
  lines.push(`  ⏱  Duration: ${elapsed} min`);
  lines.push(`  💬 Turns: ${stats.turnCount}`);
  lines.push(`  👤 User messages: ${userRecords.length}`);
  lines.push(`  🤖 Agent responses: ${assistantRecords.length}`);
  lines.push("");

  const frustRecent = stats.getFrustrationMovingAverage(5);
  const { emoji: recentEmoji, label: recentLabel } = getMoodFace(frustRecent);
  lines.push(`  ┌─ Frustration ────────────────────────┐`);
  lines.push(`  │  Overall:  ${renderGauge(frustAvg, 5)}  ${frustAvg.toFixed(1)}/5`);
  lines.push(`  │  Recent:   ${renderGauge(frustRecent, 5)}  ${frustRecent.toFixed(1)}/5  ${recentEmoji} ${recentLabel}`);
  lines.push(`  └──────────────────────────────────────┘`);
  lines.push("");

  const helpAvg = stats.getAverageHelpfulness();
  if (helpAvg > 0) {
    const helpFace = getHelpFace(helpAvg);
    lines.push(`  ┌─ Helpfulness ───────────────────────┐`);
    lines.push(`  │  Average:  ${renderGauge(helpAvg, 5)}  ${helpAvg.toFixed(1)}/5  ${helpFace}`);
    lines.push(`  └──────────────────────────────────────┘`);
    lines.push("");
  }

  if (trajectory.length > 1) {
    const frustVals = trajectory.map((t) => t.frustration);
    const helpVals = trajectory.map((t) => t.helpfulness);
    lines.push(`  ┌─ Trajectory ────────────────────────┐`);
    lines.push(`  │  Frustration: ${sparkline(frustVals, 5)}  (over ${trajectory.length} turns)`);
    lines.push(`  │  Helpfulness: ${sparkline(helpVals, 5)}`);
    lines.push(`  └──────────────────────────────────────┘`);
    lines.push("");
  }

  const intents = stats.getIntentBreakdown();
  const intentEntries = Object.entries(intents).sort((a, b) => b[1] - a[1]);
  if (intentEntries.length > 0) {
    const maxCount = intentEntries[0][1];
    const intentEmojis: Record<string, string> = {
      question: "❓",
      command: "⚡",
      complaint: "😡",
      "follow-up": "🔄",
      clarification: "🔍",
    };
    lines.push(`  ┌─ What you've been doing ─────────────┐`);
    for (const [intent, count] of intentEntries) {
      const bar = "█".repeat(Math.max(1, Math.round((count / maxCount) * 15)));
      const icon = intentEmojis[intent] ?? "•";
      lines.push(`  │  ${icon} ${intent.padEnd(14)} ${bar} ${count}`);
    }
    lines.push(`  └──────────────────────────────────────┘`);
    lines.push("");
  }

  const responseTypes = stats.getResponseTypeBreakdown();
  const rtEntries = Object.entries(responseTypes).sort((a, b) => b[1] - a[1]);
  if (rtEntries.length > 0) {
    const maxCount = rtEntries[0][1];
    const rtEmojis: Record<string, string> = {
      direct_answer: "🎯",
      hedged_answer: "🌊",
      clarifying_question: "🤔",
      refusal: "🚫",
      off_topic: "🌀",
    };
    lines.push(`  ┌─ Agent response types ───────────────┐`);
    for (const [type, count] of rtEntries) {
      const bar = "█".repeat(Math.max(1, Math.round((count / maxCount) * 15)));
      const icon = rtEmojis[type] ?? "•";
      const label = type.replace(/_/g, " ");
      lines.push(`  │  ${icon} ${label.padEnd(18)} ${bar} ${count}`);
    }
    lines.push(`  └──────────────────────────────────────┘`);
    lines.push("");
  }

  const patterns = stats.detectPatterns();
  if (patterns.length > 0) {
    lines.push(`  ⚠️  Patterns detected:`);
    for (const p of patterns) {
      lines.push(`     → ${p.label}`);
      lines.push(`       ${p.detail}`);
    }
    lines.push("");
  }

  if (patterns.length === 0 && userRecords.length < 6) {
    lines.push(`  💡 Need more interactions to detect patterns`);
    lines.push("");
  }

  lines.push(getVibeCheck(frustAvg, helpAvg));

  return lines;
}

function renderGauge(value: number, max: number): string {
  const filled = Math.round((value / max) * 15);
  const empty = 15 - filled;
  const bar = "▓".repeat(filled) + "░".repeat(empty);
  return `[${bar}]`;
}

function getVibeCheck(frustration: number, helpfulness: number): string {
  if (frustration === 0) return "  🫥 No vibes yet — start chatting!";
  if (frustration > 3.5) return "  🔥 Things are heating up — deep breaths";
  if (frustration > 2.5 && helpfulness < 3) return "  😬 Rough session — hang in there";
  if (frustration < 2 && helpfulness > 3.5) return "  ✨ Vibes are immaculate";
  if (frustration < 2) return "  😎 Smooth sailing";
  return "  🫠 It's going... it's going";
}
