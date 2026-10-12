// apps/web/lib/palmistry/interpreter.ts
// Industry-grade interpretation engine — cross-line analysis, graded readings

import type {
  PalmAnalysisResult, PalmReading, ReadingSection,
  LineAnalysis, HandElement,
} from "./types";
import {
  LINE_DISPLAY, ELEMENT_TRAITS, FINGER_SHAPE_MEANINGS,
  LINE_RULES_MAP, MOUNT_KNOWLEDGE,
} from "./knowledge";

function interpretLine(name: string, line: LineAnalysis): ReadingSection {
  const info = LINE_DISPLAY[name];
  if (!info) {
    return { title: name, icon: "◆", content: "", highlights: [], score: 0 };
  }
  const rules = LINE_RULES_MAP[name] ?? [];
  const matched = rules.filter((r) => r.condition(line));
  const positives = matched.filter((r) => r.sentiment === "positive");
  const challenges = matched.filter((r) => r.sentiment === "challenging");

  let content: string;
  if (matched.length > 0) {
    content = matched.map((r) => r.meaning).join("\n\n");
  } else if (line.present) {
    const curvatureDesc =
      line.curvature === "straight" ? "controlled, disciplined" :
      line.curvature === "curved" ? "flowing, expressive" :
      line.curvature === "wavy" ? "dynamic, evolving" : "balanced, adaptive";
    content = `Your ${info.name} shows ${line.quality} energy with ${line.length} extent. The ${curvatureDesc} pattern reveals a ${curvatureDesc.toLowerCase()} approach to ${info.governs.toLowerCase()}. With a clarity score of ${line.score}/100, this ${line.score > 70 ? "strongly defined" : line.score > 40 ? "moderately defined" : "subtly defined"} line suggests ${line.score > 70 ? "these qualities are central to your nature" : line.score > 40 ? "these qualities develop through conscious practice" : "these qualities emerge through unconventional pathways"}.`;
  } else {
    content = `Your ${info.name} is subtle or absent — this is far more common and meaningful than most realize. Rather than indicating ${info.governs.toLowerCase()} is missing, it reveals you express these qualities through other channels, often more authentically than those with prominent ${info.governs.toLowerCase()}. The absence of a strong ${info.name.toLowerCase()} often marks someone who has developed these capacities through lived experience rather than innate predisposition.`;
  }

  if (line.present) {
    const depthDesc = line.depth > 0.7 ? "exceptionally deep" : line.depth > 0.4 ? "well-defined" : "lightly marked";
    content += `\n\nThe line's ${depthDesc} quality (depth: ${Math.round(line.depth * 100)}%) ${line.depth > 0.7 ? "amplifies all other indicators — this is a core life theme" : line.depth > 0.4 ? "shows healthy engagement with this life area" : "suggests this area develops through conscious attention"}.`;
  }

  const highlights: string[] = [];
  if (line.present) {
    highlights.push(`Quality: ${line.quality}`);
    highlights.push(`Extent: ${line.length}`);
    highlights.push(`Pattern: ${line.curvature.replace("_", " ")}`);
    highlights.push(`Depth: ${Math.round(line.depth * 100)}%`);
    if (line.breaks > 0) highlights.push(`${line.breaks} transition${line.breaks > 1 ? "s" : ""} detected`);
    if (line.branches > 0) highlights.push(`${line.branches} branch${line.branches > 1 ? "es" : ""} radiating`);
    if (line.chains) highlights.push("Chain pattern present");
    if (line.forks > 0) highlights.push(`${line.forks} fork${line.forks > 1 ? "s" : ""} detected`);
    if (line.islands) highlights.push("Island formation detected");
  }
  if (positives.length > 0) highlights.push(`${positives.length} strength${positives.length > 1 ? "s" : ""} identified`);
  if (challenges.length > 0) highlights.push(`${challenges.length} growth area${challenges.length > 1 ? "s" : ""}`);

  return { title: info.name, icon: info.icon, content, highlights, score: line.score };
}

function interpretHandShape(analysis: PalmAnalysisResult): ReadingSection {
  const traits = ELEMENT_TRAITS[analysis.handShape.element];
  const fingerInfo = FINGER_SHAPE_MEANINGS[analysis.handShape.dominantFingerShape];

  const ratioDesc = analysis.handShape.fingerRatio > 1.2
    ? "significantly above average — you are a meticulous thinker who processes details others miss"
    : analysis.handShape.fingerRatio > 1
      ? "above average — you balance thoroughness with decisiveness"
      : analysis.handShape.fingerRatio > 0.85
        ? "balanced — you switch between detail and big-picture thinking fluidly"
        : "below average — you are a rapid decision-maker who trusts instinct over analysis";

  const content = `${traits.description}\n\nYour ${fingerInfo.name.toLowerCase()} amplify this with: ${fingerInfo.traits.join(", ")}.\n\nFinger-to-palm ratio of ${analysis.handShape.fingerRatio.toFixed(2)} (${ratioDesc}).\n\nClassification confidence: ${Math.round(analysis.handShape.confidence * 100)}% — ${analysis.handShape.confidence > 0.7 ? "a strong elemental signal" : analysis.handShape.confidence > 0.5 ? "a moderate signal with some blended traits" : "a mixed signal suggesting you draw from multiple elements"}.`;

  return {
    title: traits.name,
    icon: traits.icon,
    content,
    highlights: [
      `Element: ${traits.name}`,
      `Finger ratio: ${analysis.handShape.fingerRatio.toFixed(2)}`,
      `Finger shape: ${fingerInfo.name}`,
      ...traits.strengths.slice(0, 2).map((s) => `✦ ${s}`),
    ],
    score: analysis.handShape.confidence * 100,
  };
}

function interpretMounts(analysis: PalmAnalysisResult): ReadingSection {
  const sorted = [...analysis.mounts].sort((a, b) => b.score - a.score);
  const topMounts = sorted.slice(0, 4);
  const weakest = sorted.slice(-2);

  const lines = topMounts.map((m) => {
    const knowledge = Object.entries(MOUNT_KNOWLEDGE).find(([, v]) => v.name === m.name);
    const interp = knowledge?.[1]?.interpretations?.[m.development] ?? `${m.name} shows ${m.development.replace("_", " ")} energy.`;
    return `${knowledge?.[1]?.icon ?? "◆"} **${m.name}** (${m.development.replace("_", " ")} — ${m.score}/100): ${interp}`;
  });

  const weakNote = weakest.length > 0 && weakest[0]!.score < 35
    ? `\n\nYour less developed mounts — ${weakest.map((m) => m.name).join(" and ")} — indicate areas where you consciously build strength rather than relying on natural endowment. This conscious development often produces more lasting growth than innate talent.`
    : "";

  const content = `Your most developed energy centers reveal where your natural strength concentrates:\n\n${lines.join("\n\n")}${weakNote}`;

  return {
    title: "Mount Analysis",
    icon: "⛰️",
    content,
    highlights: topMounts.map((m) => `${m.name}: ${m.development.replace("_", " ")} (${m.score})`),
    score: Math.round(topMounts.reduce((a, m) => a + m.score, 0) / topMounts.length),
  };
}

function generateSummary(analysis: PalmAnalysisResult): string {
  const element = ELEMENT_TRAITS[analysis.handShape.element];
  const topLines = Object.entries(analysis.lines)
    .filter(([, l]) => l.present)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 3);

  const lineNames = topLines.map(([name]) => LINE_DISPLAY[name]?.name ?? name).join(", ");
  const traits = analysis.dominantTraits.slice(0, 3).join(", ");

  const elementDesc =
    analysis.handShape.element === "fire" ? "passionate, dynamic" :
    analysis.handShape.element === "earth" ? "grounded, reliable" :
    analysis.handShape.element === "air" ? "intellectual, communicative" :
    "intuitive, empathic";

  const activity =
    analysis.handShape.element === "fire" ? "creating and inspiring" :
    analysis.handShape.element === "earth" ? "building and nurturing" :
    analysis.handShape.element === "air" ? "thinking and connecting" :
    "feeling and intuiting";

  const handDesc = analysis.handSide === "right"
    ? "Your right hand reflects your present path and developed potential"
    : "Your left hand reveals your innate gifts and birth potential";

  return `Your ${element.name.toLowerCase()} reveals a ${elementDesc} nature. Your strongest features — ${lineNames || "the subtle interplay of your lines"} — highlight ${traits.toLowerCase() || "a unique blend of qualities"}. ${handDesc}, showing a soul actively ${activity}. With an overall clarity score of ${analysis.overallScore}/100, your palm ${analysis.overallScore > 70 ? "displays remarkable definition — your traits are strongly expressed and clearly directed" : analysis.overallScore > 45 ? "shows healthy development across multiple areas — you are growing into your full potential" : "reveals a subtle, evolving pattern — your qualities are emerging and deepening with experience"}.`;
}

export function interpretAnalysis(analysis: PalmAnalysisResult): PalmReading {
  const sections: ReadingSection[] = [];

  sections.push(interpretHandShape(analysis));

  const lineOrder = ["heart", "head", "life", "fate", "sun", "marriage"] as const;
  for (const name of lineOrder) {
    const line = analysis.lines[name];
    if (line.present || name === "heart" || name === "head" || name === "life") {
      sections.push(interpretLine(name, line));
    }
  }

  sections.push(interpretMounts(analysis));

  return {
    analysis,
    summary: generateSummary(analysis),
    sections,
  };
}
