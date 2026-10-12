// apps/web/lib/dream/interpreter.ts
// Rule-based interpretation engine — converts dream analysis to human-readable readings

import type {
  DreamAnalysisResult, DreamReading, DreamReadingSection,
} from "./types";
import {
  SYMBOL_DICTIONARY, THEME_INTERPRETATIONS,
  ARCHETYPE_PROFILES, EMOTION_PROFILES,
} from "./knowledge";

function interpretThemes(analysis: DreamAnalysisResult): DreamReadingSection {
  if (analysis.themes.length === 0) {
    return {
      title: "Dream Themes",
      icon: "🌙",
      content: "Your dream's themes are subtle and may require deeper reflection. Try recalling specific scenarios, locations, or actions — these often reveal the underlying thematic structure.",
      insights: ["Record more details upon waking", "Notice recurring patterns across dreams", "Pay attention to the emotional tone"],
    };
  }

  const topThemes = analysis.themes.slice(0, 3);
  const lines = topThemes.map((t) => {
    const interp = THEME_INTERPRETATIONS[t.theme];
    const intensityLabel = t.intensity > 0.7 ? "strongly present" : t.intensity > 0.4 ? "present" : "subtly present";
    return `${interp.icon} **${interp.name}** (${intensityLabel}): ${interp.coreMeaning}\n\n${interp.psychologicalLayer}`;
  });

  const insights = topThemes.map((t) => {
    const interp = THEME_INTERPRETATIONS[t.theme];
    return `${interp.icon} ${interp.name}: ${interp.questions[0]}`;
  });

  return {
    title: "Dream Themes",
    icon: "🌙",
    content: lines.join("\n\n---\n\n"),
    insights,
  };
}

function interpretSymbols(analysis: DreamAnalysisResult): DreamReadingSection {
  if (analysis.symbols.length === 0) {
    return {
      title: "Symbolic Content",
      icon: "🔮",
      content: "No strong symbolic patterns were detected in your dream description. This doesn't mean your dream lacks meaning — some dreams operate primarily through emotional tone and atmosphere rather than distinct symbols.",
      insights: ["Focus on how the dream felt rather than what happened", "Consider the overall mood as a symbol itself", "Some dreams are direct emotional processing"],
    };
  }

  const lines = analysis.symbols.slice(0, 6).map((s) => {
    const entry = SYMBOL_DICTIONARY.find((e) => e.keywords[0] === s.symbol);
    if (!entry) return null;
    const sentimentLabel = entry.sentiment === "positive" ? "✦" : entry.sentiment === "challenging" ? "◇" : entry.sentiment === "transformative" ? "⟡" : "○";
    return `${sentimentLabel} **${s.symbol.charAt(0).toUpperCase() + s.symbol.slice(1)}** (${s.category}): ${entry.meaning}\n\n*Jungian layer:* ${entry.jungianLayer}`;
  }).filter(Boolean);

  return {
    title: "Symbolic Content",
    icon: "🔮",
    content: lines.join("\n\n"),
    insights: analysis.symbols.slice(0, 4).map((s) => {
      const entry = SYMBOL_DICTIONARY.find((e) => e.keywords[0] === s.symbol);
      return `${s.symbol}: ${entry?.sentiment ?? "neutral"} energy — ${entry?.themes[0] ? `related to ${entry.themes[0].replace("_", " ")}` : "unique personal significance"}`;
    }),
  };
}

function interpretArchetypes(analysis: DreamAnalysisResult): DreamReadingSection {
  if (analysis.archetypes.length === 0) {
    return {
      title: "Archetypal Dynamics",
      icon: "⚡",
      content: "Your dream's archetypal patterns are subtle. This may indicate a more personal, less mythic dream — one that's processing daily experience rather than touching the collective unconscious.",
      insights: ["Not all dreams are archetypal — some are personal processing", "Pay attention to emotional intensity as an archetype indicator", "Recurring dreams often carry stronger archetypal weight"],
    };
  }

  const topArch = analysis.archetypes.slice(0, 3);
  const lines = topArch.map((a) => {
    const profile = ARCHETYPE_PROFILES[a.archetype];
    const presenceLabel = a.presence > 0.7 ? "strongly active" : a.presence > 0.4 ? "active" : "subtly present";
    return `${profile.icon} **${profile.name}** (${presenceLabel})\n\nManifestations: ${a.manifestations.join(", ")}\n\n${profile.description}\n\n*Integration path:* ${profile.integrationPath}`;
  });

  return {
    title: "Archetypal Dynamics",
    icon: "⚡",
    content: lines.join("\n\n---\n\n"),
    insights: topArch.map((a) => {
      const profile = ARCHETYPE_PROFILES[a.archetype];
      return `${profile.icon} ${profile.name}: ${profile.positiveExpression.split(".")[0]}`;
    }),
  };
}

function interpretEmotions(analysis: DreamAnalysisResult): DreamReadingSection {
  if (analysis.emotions.length === 0) {
    return {
      title: "Emotional Landscape",
      icon: "💫",
      content: "The emotional tone of your dream wasn't clearly detected. Try to recall how you felt during the dream — emotions are often the most reliable guide to a dream's meaning.",
      insights: ["Emotions are the dream's compass", "Even vague feelings (uneasy, peaceful) are significant", "The same scenario can have completely different meanings based on emotion"],
    };
  }

  const topEmotions = analysis.emotions.slice(0, 3);
  const lines = topEmotions.map((e) => {
    const profile = EMOTION_PROFILES[e.emotion];
    const intensityLabel = e.intensity > 0.7 ? "intensely" : e.intensity > 0.4 ? "moderately" : "subtly";
    return `${profile.icon} **${profile.name}** (${intensityLabel} felt)\n\n${profile.meaning}\n\n*Body location:* ${profile.bodyLocation}\n\n*Integration:* ${profile.integrationPath}`;
  });

  return {
    title: "Emotional Landscape",
    icon: "💫",
    content: lines.join("\n\n---\n\n"),
    insights: topEmotions.map((e) => {
      const profile = EMOTION_PROFILES[e.emotion];
      return `${profile.icon} ${profile.name}: felt in the ${profile.bodyLocation.toLowerCase()}`;
    }),
  };
}

function interpretSpecialFeatures(analysis: DreamAnalysisResult): DreamReadingSection {
  const parts: string[] = [];
  const insights: string[] = [];

  if (analysis.lucidityIndicators > 0.3) {
    parts.push("🌟 **Lucidity Indicators Detected**: Your dream shows signs of conscious awareness within the dream state. This suggests you're developing the capacity for lucid dreaming — the ability to be aware that you're dreaming while still in the dream. This is a powerful tool for psychological growth and creative exploration.");
    insights.push("Lucidity detected — you're developing awareness within dreams");
  }

  if (analysis.recurrenceIndicators > 0.3) {
    parts.push("🔄 **Recurrence Pattern**: Your dream shows indicators of being a recurring dream. Recurring dreams are the psyche's way of highlighting an unresolved issue — something that needs attention keeps returning until you address it. The fact that it recurs means the message is important.");
    insights.push("Recurring pattern — an unresolved issue seeking attention");
  }

  if (parts.length === 0) {
    parts.push("Your dream appears to be a standard processing dream — your psyche's nightly work of integrating daily experiences, emotions, and memories. These dreams are essential for psychological health even when they don't carry dramatic symbolic content.");
    insights.push("Standard processing dream — essential nightly psychological work");
  }

  return {
    title: "Special Features",
    icon: "✨",
    content: parts.join("\n\n"),
    insights,
  };
}

function generateSummary(analysis: DreamAnalysisResult): string {
  const parts: string[] = [];

  if (analysis.themes.length > 0) {
    const topTheme = THEME_INTERPRETATIONS[analysis.themes[0]!.theme];
    parts.push(`Your dream weaves the theme of ${topTheme.name.toLowerCase()} — ${topTheme.coreMeaning.toLowerCase()}.`);
  }

  if (analysis.symbols.length > 0) {
    const symbolNames = analysis.symbols.slice(0, 3).map((s) => s.symbol).join(", ");
    parts.push(`Key symbols include ${symbolNames}, each carrying deep archetypal resonance.`);
  }

  if (analysis.emotions.length > 0) {
    const topEmo = EMOTION_PROFILES[analysis.emotions[0]!.emotion];
    parts.push(`The emotional core of ${topEmo.name.toLowerCase()} reveals ${topEmo.meaning.split("—")[1]?.trim().toLowerCase() ?? "an important aspect of your inner world"}.`);
  }

  if (analysis.archetypes.length > 0) {
    const topArch = ARCHETYPE_PROFILES[analysis.archetypes[0]!.archetype];
    parts.push(`The ${topArch.name} archetype is at work, inviting you toward ${topArch.integrationPath.split(".")[0]?.toLowerCase() ?? "deeper self-knowledge"}.`);
  }

  if (parts.length === 0) {
    return "Your dream carries subtle but meaningful content. Record it fully upon waking — dream meanings often reveal themselves over hours and days, not just in the first moment of interpretation.";
  }

  return parts.join(" ");
}

export function interpretDream(analysis: DreamAnalysisResult): DreamReading {
  const sections: DreamReadingSection[] = [];

  sections.push(interpretThemes(analysis));
  sections.push(interpretSymbols(analysis));
  sections.push(interpretArchetypes(analysis));
  sections.push(interpretEmotions(analysis));
  sections.push(interpretSpecialFeatures(analysis));

  return {
    analysis,
    summary: generateSummary(analysis),
    sections,
  };
}
