// ============================================================================
// Human Psychology — Deep Training Corpus for AI Consultants
// ============================================================================
// Research-backed frameworks from real psychology literature. Each chunk
// encodes a specific, actionable technique the AI can weave into conversation
// naturally — not as therapy, but as a wise human practitioner would.
//
// Sources: peer-reviewed psychology books, clinical manuals, and established
// therapeutic frameworks (CBT, ACT, DBT, EFT, NVC, MI, attachment theory).
// ============================================================================

import type { TrainingChunk } from "./index";

export const HUMAN_PSYCHOLOGY_DATA: TrainingChunk[] = [
  // ─── Emotional Intelligence (Goleman, Brackett, Gross) ────────────────────
  {
    id: "hpsych-001", domain: "psychology", category: "emotional-intelligence",
    title: "Emotional Granularity — Name It to Tame It",
    content: "People who can distinguish between 'frustrated', 'disappointed', and 'hurt' recover faster than those who just feel 'bad'. When someone shares pain, help them name the specific emotion. 'It sounds like you're feeling let down, not just angry' — this precision activates the prefrontal cortex and calms the amygdala. Never say 'I understand' — say 'It sounds like...' and let them correct you.",
    keywords: ["emotions", "feelings", "naming", "granularity", "emotional intelligence", "sad", "angry", "hurt"],
    source: "How Emotions Are Made — Lisa Feldman Barrett",
  },
  {
    id: "hpsych-002", domain: "psychology", category: "emotional-intelligence",
    title: "The Mood Meter — Four Quadrants of Feeling",
    content: "All emotions map to two axes: energy (high/low) × pleasantness (pleasant/unpleasant). High-energy-unpleasant = angry, anxious, frustrated. High-energy-pleasant = excited, joyful. Low-energy-unpleasant = sad, depressed, hopeless. Low-energy-pleasant = calm, peaceful. Match your response to their quadrant: angry people need acknowledgment before solutions; sad people need presence before advice; anxious people need certainty before exploration.",
    keywords: ["mood", "energy", "anxious", "angry", "sad", "calm", "quadrant", "feelings"],
    source: "Permission to Feel — Marc Brackett",
  },
  {
    id: "hpsych-003", domain: "psychology", category: "emotional-intelligence",
    title: "Emotion Regulation — The Window of Tolerance",
    content: "Everyone has a window where they can think clearly and feel without being overwhelmed. Outside it: hyperarousal (panic, rage, flooding) or hypoarousal (numb, shut down, dissociated). When someone is outside their window, reasoning fails. First regulate: slow breathing, grounding ('name 5 things you can see'), validation ('that makes sense you'd feel that way'). Only then explore the issue.",
    keywords: ["window of tolerance", "regulation", "panic", "numb", "grounding", "overwhelm", "flooding"],
    source: "The Body Keeps the Score — Bessel van der Kolk",
  },

  // ─── Motivational Interviewing (Miller & Rollnick) ────────────────────────
  {
    id: "hpsych-004", domain: "psychology", category: "motivational-interviewing",
    title: "OARS — The Core MI Skills",
    content: "O = Open questions ('What brings you here?' not 'Are you sad?'). A = Affirmations ('You took a brave step coming here'). R = Reflections (mirror back: 'So part of you wants to stay, part wants to leave'). S = Summaries (tie together what they've said, every few turns). These four skills create the conditions for someone to find their own motivation for change — you never impose it.",
    keywords: ["motivation", "change", "OARS", "open questions", "reflection", "affirmation"],
    source: "Motivational Interviewing — Miller & Rollnick",
  },
  {
    id: "hpsych-005", domain: "psychology", category: "motivational-interviewing",
    title: "Change Talk vs Sustain Talk",
    content: "When someone says 'I wish things were different' — that's change talk, lean into it: 'What would different look like?' When they say 'But it's too hard to change' — that's sustain talk, don't argue, reflect: 'So the difficulty feels real and important.' The trick: evoke their own arguments for change. Ask: 'What worries you about staying exactly as things are?' Their answer is more powerful than anything you could say.",
    keywords: ["change talk", "sustain talk", "motivation", "ambivalence", "worry", "stuck"],
    source: "Motivational Interviewing — Miller & Rollnick",
  },
  {
    id: "hpsych-006", domain: "psychology", category: "motivational-interviewing",
    title: "The Righting Reflex — Why Advice Backfires",
    content: "When someone shares a problem, the helper's instinct is to fix it — this is the 'righting reflex'. But unsolicited advice triggers resistance. Instead: ask permission ('Would it help to explore options?'), then elicit their ideas first ('What have you thought about trying?'). People commit to their own solutions, not yours. The paradox: the less you push change, the more change happens.",
    keywords: ["advice", "resistance", "righting reflex", "permission", "solutions", "push"],
    source: "Motivational Interviewing — Miller & Rollnick",
  },
  {
    id: "hpsych-007", domain: "psychology", category: "motivational-interviewing",
    title: "Rolling with Resistance — The Dance, Not the Fight",
    content: "When someone pushes back ('You don't understand', 'That won't work for me'), don't counter. Reframe: 'So from your perspective, this approach doesn't fit.' Amplify their autonomy: 'You're the expert on your life — I'm just here to help you think through it.' Resistance is a signal the helper is pushing too hard, not that the client is difficult. Step back, reflect, let them lead.",
    keywords: ["resistance", "push back", "autonomy", "reframe", "difficult", "signal"],
    source: "Motivational Interviewing — Miller & Rollnick",
  },

  // ─── Non-Violent Communication (Marshall Rosenberg) ───────────────────────
  {
    id: "hpsych-008", domain: "psychology", category: "non-violent-communication",
    title: "Four Steps of NVC — Observation, Feeling, Need, Request",
    content: "When someone is upset, decode their message: What did they observe (without judgment)? What are they feeling? What need is unmet? What request would help? Example: 'You never listen' → observation: 'When I'm speaking and you look at your phone' → feeling: 'I feel hurt' → need: 'I need to feel heard' → request: 'Would you put it down for 5 minutes?' Help them translate blame into need.",
    keywords: ["NVC", "needs", "feelings", "observation", "request", "blame", "communication"],
    source: "Nonviolent Communication — Marshall Rosenberg",
  },
  {
    id: "hpsych-009", domain: "psychology", category: "non-violent-communication",
    title: "Empathy vs Sympathy — The Difference That Heals",
    content: "Sympathy = 'I'm sorry you feel that way' (creates distance). Empathy = 'That sounds really painful' (creates connection). Empathy doesn't fix, advise, or compare ('I know how you feel'). It witnesses. The most healing thing you can say: 'You're not alone in this.' Then be quiet and let them feel heard. People don't need solutions as much as they need to feel understood.",
    keywords: ["empathy", "sympathy", "connection", "witness", "alone", "understood", "heard"],
    source: "Nonviolent Communication — Marshall Rosenberg",
  },
  {
    id: "hpsych-010", domain: "psychology", category: "non-violent-communication",
    title: "Jackal vs Giraffe Language",
    content: "Jackal language judges, blames, demands: 'You always...', 'You should...', 'That's wrong.' Giraffe language observes, feels, requests: 'When X happens, I feel Y because I need Z. Would you be willing to...?' When someone speaks jackal, translate to giraffe in your response. 'You're saying you feel frustrated because you need more consideration?' This de-escalates and models healthier communication.",
    keywords: ["jackal", "giraffe", "blame", "judge", "translate", "de-escalate", "consideration"],
    source: "Nonviolent Communication — Marshall Rosenberg",
  },

  // ─── Attachment Theory (Bowlby, Ainsworth, Levine & Heller) ──────────────
  {
    id: "hpsych-011", domain: "psychology", category: "attachment-theory",
    title: "Four Attachment Styles — The Relational Blueprint",
    content: "Secure: comfortable with intimacy and independence. Anxious: fears abandonment, seeks constant reassurance, reads into silences. Avoidant: fears engulfment, pulls away when things get close, values independence over connection. Disorganized: wants closeness but fears it, pushes and pulls unpredictably. Most relationship conflict is anxious-avoidant trap: one pursues, the other withdraws, both feel unloved.",
    keywords: ["attachment", "anxious", "avoidant", "secure", "disorganized", "abandonment", "intimacy"],
    source: "Attached — Amir Levine & Rachel Heller",
  },
  {
    id: "hpsych-012", domain: "psychology", category: "attachment-theory",
    title: "The Anxious-Avoidant Trap",
    content: "When an anxious person feels distance, they protest (call more, seek reassurance, get emotional). When an avoidant person feels pressure, they withdraw (go quiet, need space, pull back). This creates a vicious cycle: the more one pursues, the more the other withdraws. Break the cycle: anxious person self-soothes before reaching out; avoidant person communicates need for space with a return time. Both need to feel safe.",
    keywords: ["anxious", "avoidant", "trap", "cycle", "protest", "withdraw", "pursue", "space"],
    source: "Attached — Amir Levine & Rachel Heller",
  },
  {
    id: "hpsych-013", domain: "psychology", category: "attachment-theory",
    title: "Attachment Triggers in Daily Life",
    content: "Anxious triggers: delayed text reply, partner needing space, ambiguous tone, cancelled plans, silence after argument. Avoidant triggers: too many calls, demands for emotional talk, feeling controlled, partner crying, plans for too much togetherness. When someone describes relationship pain, listen for which triggers they mention — it reveals their attachment style and what they actually need (reassurance vs space).",
    keywords: ["triggers", "text", "space", "calls", "silence", "emotional", "reassurance"],
    source: "Attached — Amir Levine & Rachel Heller",
  },
  {
    id: "hpsych-014", domain: "psychology", category: "attachment-theory",
    title: "Earned Security — Attachment Can Change",
    content: "Attachment style isn't fixed. Through conscious relationships (romantic, therapeutic, or spiritual), insecure people develop earned security. The path: recognize your trigger pattern → pause before reacting → communicate the need directly → have the need met (even partially) → repeat. Over time, the nervous system learns: 'I can be close and safe.' This is what good guidance does — builds earned security.",
    keywords: ["earned security", "change", "pattern", "pause", "communicate", "nervous system", "safe"],
    source: "Attached — Amir Levine & Rachel Heller",
  },

  // ─── Trauma-Informed Care (van der Kolk, Herman, Porges) ─────────────────
  {
    id: "hpsych-015", domain: "psychology", category: "trauma-informed",
    title: "The Body Keeps the Score — Trauma Lives in Physiology",
    content: "Trauma isn't just a story — it's a body state. Hypervigilance, muscle tension, startle response, numbness, dissociation. When someone describes past pain, notice if their body is reacting NOW (fast breathing, tense voice, going quiet). Don't push them to relive it. Ground first: 'You're safe here. Take your time.' Offer choices: 'Would it help to take a break?' Trauma-informed means never forcing someone to feel unsafe to heal.",
    keywords: ["trauma", "body", "hypervigilance", "dissociation", "ground", "safe", "tension"],
    source: "The Body Keeps the Score — Bessel van der Kolk",
  },
  {
    id: "hpsych-016", domain: "psychology", category: "trauma-informed",
    title: "Polyvagal Theory — Three Nervous System States",
    content: "Ventral vagal (safe/social): face relaxed, voice warm, can think clearly, open to connection. Sympathetic (fight/flight): tense, urgent, racing thoughts, ready to act. Dorsal vagal (freeze/collapse): numb, flat, shut down, can't think. Match your response to their state: social state → explore; fight/flight → validate and slow down; freeze → gentle presence, don't demand responses. You can't reason someone out of a survival state.",
    keywords: ["polyvagal", "nervous system", "fight", "flight", "freeze", "safe", "social", "survival"],
    source: "The Polyvagal Theory — Stephen Porges",
  },
  {
    id: "hpsych-017", domain: "psychology", category: "trauma-informed",
    title: "Complex PTSD — The Invisible Wound",
    content: "C-PTSD comes from repeated relational trauma (childhood neglect, emotional abuse, domestic violence). Symptoms: emotional flashbacks (sudden intense fear/sadness with no present trigger), toxic shame ('I'm fundamentally broken'), inner critic (harsh self-judgment), social anxiety, difficulty trusting. When someone describes feeling 'broken' or 'too much', this may be C-PTSD speaking. Respond with: 'That's the shame talking, not the truth.'",
    keywords: ["C-PTSD", "complex trauma", "flashback", "shame", "inner critic", "broken", "trust"],
    source: "Complex PTSD — Pete Walker",
  },
  {
    id: "hpsych-018", domain: "psychology", category: "trauma-informed",
    title: "Emotional Flashbacks — When Past Hijacks Present",
    content: "Unlike PTSD flashbacks (visual reliving), emotional flashbacks are sudden regressions to the FEELING state of childhood trauma — intense fear, shame, abandonment — with no visual memory. The person feels like a small, helpless child inside an adult body. Help: 'You're having a flashback. You're safe now. This feeling is from the past, not the present.' Name it, ground them, remind them: feelings are not facts.",
    keywords: ["flashback", "emotional flashback", "regression", "fear", "shame", "child", "past"],
    source: "Complex PTSD — Pete Walker",
  },

  // ─── Cognitive Psychology & Behavioral Science ────────────────────────────
  {
    id: "hpsych-019", domain: "psychology", category: "cognitive-psychology",
    title: "Cognitive Distortions — The 10 Thinking Traps",
    content: "All-or-nothing ('If I'm not perfect, I'm a failure'). Overgeneralization ('This always happens to me'). Mental filter (ignoring positives, magnifying negatives). Disqualifying the positive ('That doesn't count'). Mind reading ('They think I'm stupid'). Fortune telling ('It'll never work out'). Catastrophizing ('This is the worst thing ever'). Should statements ('I should be over this by now'). Labeling ('I'm a loser'). Personalization ('It's all my fault').",
    keywords: ["cognitive distortions", "thinking traps", "all-or-nothing", "overgeneralization", "catastrophizing", "should"],
    source: "Feeling Good — David Burns",
  },
  {
    id: "hpsych-020", domain: "psychology", category: "cognitive-psychology",
    title: "The Socratic Method — Questions That Change Thinking",
    content: "Don't tell someone their thinking is wrong — ask questions that let them discover it. 'What evidence supports that thought? What evidence contradicts it? If your friend had this thought, what would you tell them? What's the most balanced way to see this?' The goal isn't positive thinking — it's accurate thinking. People change when they see the gap between their thought and reality themselves.",
    keywords: ["socratic", "questions", "evidence", "balanced thinking", "discover", "gap"],
    source: "Cognitive Therapy — Aaron Beck",
  },
  {
    id: "hpsych-021", domain: "psychology", category: "cognitive-psychology",
    title: "Behavioral Activation — Action Before Motivation",
    content: "Depression creates a cycle: feel bad → do nothing → feel worse → do less. The antidote isn't waiting for motivation — it's acting first. Schedule one small pleasant activity daily (walk, call a friend, cook a meal). Do it even when you don't want to. Motivation follows action, not the reverse. The brain's reward system activates with movement. Start tiny: 'Today I'll step outside for 5 minutes.'",
    keywords: ["behavioral activation", "depression", "motivation", "action", "schedule", "reward", "cycle"],
    source: "Overcoming Depression — Daniel Strunk",
  },
  {
    id: "hpsych-022", domain: "psychology", category: "cognitive-psychology",
    title: "Exposure Principle — Face the Fear to Shrink It",
    content: "Avoidance makes anxiety grow. Every time you avoid something scary, the brain learns 'That's dangerous — good thing we escaped.' Exposure reverses this: face the feared situation (gradually, safely), stay in it until anxiety drops naturally. The brain learns 'I survived — it's not that dangerous.' Hierarchy: list feared situations from easiest to hardest. Start with the easiest. Repeat until boring. Move up.",
    keywords: ["exposure", "avoidance", "anxiety", "fear", "hierarchy", "survive", "gradual"],
    source: "The Anxiety and Phobia Workbook — Edmund Bourne",
  },

  // ─── Positive Psychology & Well-being (Seligman, Fredrickson) ────────────
  {
    id: "hpsych-023", domain: "psychology", category: "positive-psychology",
    title: "PERMA — Five Pillars of Flourishing",
    content: "Well-being isn't just absence of suffering. PERMA: P = Positive emotions (joy, gratitude, hope). E = Engagement (flow states, losing track of time). R = Relationships (deep connection, feeling known). M = Meaning (serving something bigger than yourself). A = Achievement (mastery, progress, competence). When someone feels stuck, ask which pillar is missing. Often it's R or M — connection and purpose.",
    keywords: ["PERMA", "flourishing", "well-being", "engagement", "flow", "meaning", "purpose", "achievement"],
    source: "Flourish — Martin Seligman",
  },
  {
    id: "hpsych-024", domain: "psychology", category: "positive-psychology",
    title: "Broaden-and-Build — Positive Emotions Expand Thinking",
    content: "Negative emotions narrow attention (tunnel vision, survival mode). Positive emotions broaden it (creative thinking, seeing possibilities, connecting ideas). This isn't just feel-good — it's evolutionary. Joy builds social bonds. Curiosity builds knowledge. Gratitude builds reciprocity. When someone is stuck in negativity, don't argue them into positivity — create a micro-moment of positive emotion first (humor, beauty, kindness), then explore.",
    keywords: ["broaden", "positive emotions", "negativity", "curiosity", "joy", "gratitude", "expand"],
    source: "Positivity — Barbara Fredrickson",
  },
  {
    id: "hpsych-025", domain: "psychology", category: "positive-psychology",
    title: "Character Strengths — The VIA Classification",
    content: "24 character strengths across 6 virtues: Wisdom (creativity, curiosity, judgment, love of learning, perspective). Courage (bravery, perseverance, honesty, zest). Humanity (kindness, love, social intelligence). Justice (fairness, leadership, teamwork). Temperance (forgiveness, humility, prudence, self-regulation). Transcendence (appreciation of beauty, gratitude, hope, humor, spirituality). People heal fastest when using their signature strengths, not fixing weaknesses.",
    keywords: ["strengths", "character", "virtue", "wisdom", "courage", "humanity", "signature strengths"],
    source: "Character Strengths and Virtues — Peterson & Seligman",
  },

  // ─── Conversational Psychology — Making Dialogue Feel Human ───────────────
  {
    id: "hpsych-026", domain: "psychology", category: "conversational-psychology",
    title: "The Bid for Connection — Gottman's Turning Toward",
    content: "In every conversation, people make 'bids' — small attempts for attention, validation, or connection. 'Look at that sunset' (bid for shared experience). 'I had a rough day' (bid for empathy). 'What do you think?' (bid for engagement). Turning toward = acknowledging the bid. Turning away = ignoring it. Turning against = responding hostilely. Relationships thrive on 5:1 ratio of toward-turns. Always turn toward the bid first.",
    keywords: ["bid", "connection", "turning toward", "attention", "validation", "Gottman", "ratio"],
    source: "The Relationship Cure — John Gottman",
  },
  {
    id: "hpsych-027", domain: "psychology", category: "conversational-psychology",
    title: "Validation Before Solution — The Golden Rule of Helping",
    content: "When someone shares a problem, 80% of the time they want validation, not solutions. Validation = 'That makes sense you'd feel that way' or 'Anyone in your position would feel the same.' Only after validation is established, ask: 'Would you like to explore what might help?' Unsolicited solutions feel dismissive. The sequence: acknowledge → validate → normalize → then (if invited) explore options.",
    keywords: ["validation", "solution", "acknowledge", "normalize", "makes sense", "explore"],
    source: "Dialectical Behavior Therapy Skills — Marsha Linehan",
  },
  {
    id: "hpsych-028", domain: "psychology", category: "conversational-psychology",
    title: "The Power of 'And' Over 'But'",
    content: "'But' erases everything before it: 'I hear you, but...' means 'I don't actually hear you.' Replace with 'and': 'I hear you're frustrated, AND you also love them.' This holds both truths simultaneously. It's not either/or — it's both/and. This single word change transforms confrontations into collaborations. 'You're right, and there's also another angle to consider.'",
    keywords: ["and", "but", "both", "truth", "collaboration", "confrontation", "word change"],
    source: "Crucial Conversations — Patterson, Grenny et al.",
  },
  {
    id: "hpsych-029", domain: "psychology", category: "conversational-psychology",
    title: "Mirroring — The Unconscious Bonding Tool",
    content: "People naturally mirror those they feel connected to — posture, tone, pace, word choice. You can accelerate rapport by subtly mirroring their communication style. Fast talker → match pace. Slow, thoughtful → slow down. Uses their words back: if they say 'I'm overwhelmed', don't say 'You're stressed' — say 'Overwhelmed is a big feeling.' This signals deep listening at an unconscious level.",
    keywords: ["mirroring", "rapport", "pace", "tone", "style", "unconscious", "bonding"],
    source: "The Chameleon Effect — Chartrand & Bargh",
  },
  {
    id: "hpsych-030", domain: "psychology", category: "conversational-psychology",
    title: "Open-Ended Questions That Unlock Depth",
    content: "Closed questions get closed answers: 'Are you happy?' → 'Yes/No.' Open questions open exploration: 'What does happiness look like for you right now?' 'What's been on your mind lately?' 'How are you feeling about all of this?' 'What would you want to change if you could?' The best questions start with What, How, or Tell me about... Avoid Why (triggers defensiveness: 'Why did you do that?').",
    keywords: ["open questions", "exploration", "what", "how", "tell me", "depth", "unlock"],
    source: "Motivational Interviewing — Miller & Rollnick",
  },

  // ─── Grief & Loss (Kübler-Ross, Neimeyer, Worden) ────────────────────────
  {
    id: "hpsych-031", domain: "psychology", category: "grief",
    title: "The Five Stages of Grief — Not Linear, Not Universal",
    content: "Denial ('This can't be happening'). Anger ('Why me? This isn't fair'). Bargaining ('If only I had...'). Depression ('What's the point?'). Acceptance ('This is my reality now'). These are NOT sequential — people bounce between them, skip some, revisit others. The modern understanding: grief is not about stages, it's about meaning-making. The task is to reconstruct a world of meaning after loss.",
    keywords: ["grief", "stages", "denial", "anger", "bargaining", "depression", "acceptance", "loss"],
    source: "On Death and Dying — Elisabeth Kübler-Ross",
  },
  {
    id: "hpsych-032", domain: "psychology", category: "grief",
    title: "Grief as Reconstruction — Finding Meaning After Loss",
    content: "Grief isn't something to 'get over' — it's something to integrate. The four tasks: (1) Accept the reality of the loss. (2) Process the pain of grief. (3) Adjust to a world without the lost person/thing. (4) Find an enduring connection while moving forward. Don't rush task 2 — pain must be felt to be released. Help them tell the story of the loss repeatedly — each telling integrates a little more.",
    keywords: ["grief tasks", "reconstruction", "meaning", "integrate", "pain", "story", "loss"],
    source: "Attending to Grief — William Worden",
  },
  {
    id: "hpsych-033", domain: "psychology", category: "grief",
    title: "Disenfranchised Grief — When Loss Isn't Recognized",
    content: "Some losses aren't socially acknowledged: miscarriage, pet death, divorce, loss of friendship, death of ex-spouse, abortion, non-death losses (job, home, identity). The griever gets no sympathy, no rituals, no permission to mourn. This makes grief harder. Validate: 'Your loss is real, even if others don't understand it.' 'You have every right to grieve this.' Naming the disenfranchisement itself is healing.",
    keywords: ["disenfranchised grief", "unrecognized loss", "miscarriage", "divorce", "pet", "permission", "validate"],
    source: "Disenfranchised Grief — Kenneth Doka",
  },

  // ─── Self-Compassion & Inner Work (Neff, Germer, Brach) ──────────────────
  {
    id: "hpsych-034", domain: "psychology", category: "self-compassion",
    title: "Three Components of Self-Compassion",
    content: "Self-compassion = (1) Self-kindness vs self-judgment: 'It's okay to struggle' vs 'I'm so weak.' (2) Common humanity vs isolation: 'Everyone feels this way sometimes' vs 'I'm the only one.' (3) Mindfulness vs over-identification: 'I'm having a painful feeling' vs 'I AM painful.' All three must be present. Self-compassion isn't self-pity or self-indulgence — it's the courage to be kind to yourself while acknowledging pain.",
    keywords: ["self-compassion", "kindness", "humanity", "mindfulness", "judgment", "isolation"],
    source: "Self-Compassion — Kristin Neff",
  },
  {
    id: "hpsych-035", domain: "psychology", category: "self-compassion",
    title: "RAIN — The Mindful Self-Compassion Practice",
    content: "R = Recognize what's happening ('I'm feeling anxious right now'). A = Allow it to be there without trying to fix it ('This is here, and that's okay'). I = Investigate with kindness ('What does this anxiety need? What belief is underneath?'). N = Nurture with self-compassion ('May I be kind to myself in this moment'). RAIN works in real-time during difficult emotions. It creates space between stimulus and response.",
    keywords: ["RAIN", "mindfulness", "recognize", "allow", "investigate", "nurture", "self-compassion"],
    source: "Radical Acceptance — Tara Brach",
  },
  {
    id: "hpsych-036", domain: "psychology", category: "self-compassion",
    title: "The Inner Critic — Friend, Not Enemy",
    content: "The inner critic ('You're not good enough', 'You'll fail') developed as protection — it tried to prevent shame by pre-empting failure. Don't fight it (that makes it louder). Instead: thank it ('I hear you trying to protect me'), then question it ('Is this actually true? What evidence do I have?'). Give it a name or character ('Oh, that's just my inner perfectionist talking'). This creates distance without suppression.",
    keywords: ["inner critic", "perfectionism", "shame", "protection", "question", "distance", "name"],
    source: "Self-Compassion — Kristin Neff",
  },

  // ─── Behavioral Economics & Decision Psychology ───────────────────────────
  {
    id: "hpsych-037", domain: "psychology", category: "decision-psychology",
    title: "Loss Aversion — Why Fear of Loss Beats Desire for Gain",
    content: "Losing ₹1000 hurts roughly twice as much as gaining ₹1000 feels good. This asymmetry drives most human decisions: people stay in bad relationships (fear of losing what they have), avoid career changes (fear of losing security), resist spiritual growth (fear of losing identity). When advising on decisions, name the loss aversion: 'Part of you is more afraid of losing X than excited about gaining Y. Is that right?'",
    keywords: ["loss aversion", "fear", "decision", "risk", "security", "change", "gain", "loss"],
    source: "Thinking, Fast and Slow — Daniel Kahneman",
  },
  {
    id: "hpsych-038", domain: "psychology", category: "decision-psychology",
    title: "The Paradox of Choice — More Options, More Anxiety",
    content: "When people face too many choices, they freeze, ruminate, and feel less satisfied with whatever they pick. This affects career decisions, relationship choices, spiritual paths. Solution: narrow the field. 'Instead of all possible careers, what are the top 3 that excite you?' Help them choose satisficing (good enough) over maximizing (perfect). 'The best choice is the one you commit to making work.'",
    keywords: ["paradox of choice", "options", "anxiety", "freeze", "decide", "satisficing", "commit"],
    source: "The Paradox of Choice — Barry Schwartz",
  },

  // ─── Interpersonal Neurobiology & Co-regulation ───────────────────────────
  {
    id: "hpsych-039", domain: "psychology", category: "co-regulation",
    title: "Co-regulation — Nervous Systems Influence Each Other",
    content: "Humans are wired for co-regulation: our nervous systems sync with those around us. A calm presence calms an anxious person. A warm tone softens defensiveness. This is why the AI's voice matters: slow pace, warm words, steady rhythm all signal safety to the listener's nervous system. You can't calm someone with logic — you calm them with regulated presence first, then reason follows.",
    keywords: ["co-regulation", "nervous system", "calm", "presence", "safety", "sync", "tone"],
    source: "The Neurobiology of We — Daniel Siegel",
  },
  {
    id: "hpsych-040", domain: "psychology", category: "co-regulation",
    title: "Window of Tolerance in Conversation",
    content: "Every person has an optimal arousal zone where they can think, feel, and communicate. When pushed above it: racing thoughts, emotional flooding, urgency. When pushed below: numbness, dissociation, shutdown. In conversation, watch for signs: flooding → slow down, offer grounding ('Let's take a breath'). Shutdown → gently re-engage ('I'm here. Take your time.'). Stay in the window for productive dialogue.",
    keywords: ["window of tolerance", "flooding", "shutdown", "arousal", "grounding", "engage"],
    source: "The Body Keeps the Score — Bessel van der Kolk",
  },

  // ─── Existential Psychology (Frankl, Yalom, May) ──────────────────────────
  {
    id: "hpsych-041", domain: "psychology", category: "existential",
    title: "Meaning-Making — The Will to Meaning",
    content: "Humans can endure any suffering if they find meaning in it. 'He who has a why to live can bear almost any how' (Frankl). Three sources of meaning: creative (what we give to the world), experiential (what we receive from the world — love, beauty, truth), attitudinal (the stance we take toward unavoidable suffering). When someone feels lost, ask: 'What matters most to you? What would make this struggle worth it?'",
    keywords: ["meaning", "purpose", "suffering", "why", "Frankl", "will to meaning", "lost"],
    source: "Man's Search for Meaning — Viktor Frankl",
  },
  {
    id: "hpsych-042", domain: "psychology", category: "existential",
    title: "Four Ultimate Concerns — Death, Freedom, Isolation, Meaninglessness",
    content: "Yalom's existential givens: (1) Death — we all die, how do we live knowing this? (2) Freedom — we're responsible for our choices, no one else. (3) Existential isolation — we're ultimately alone in our experience. (4) Meaninglessness — the universe has no inherent meaning, we must create it. Much human anxiety stems from avoiding these truths. Gentle confrontation: 'What would you do if you weren't afraid?'",
    keywords: ["existential", "death", "freedom", "isolation", "meaninglessness", "Yalom", "anxiety", "responsibility"],
    source: "Existential Psychotherapy — Irvin Yalom",
  },
  {
    id: "hpsych-043", domain: "psychology", category: "existential",
    title: "Logotherapy — Finding Meaning in Suffering",
    content: "Frankl's approach: meaning can be found in any situation, even suffering. The technique of 'paradoxical intention': instead of fighting the symptom, prescribe it. Afraid of anxiety? 'Try to be as anxious as possible.' This removes the fear-of-fear cycle. Also: dereflection — stop focusing on the problem, focus on meaning. 'What can this experience teach you? Who can you become through it?'",
    keywords: ["logotherapy", "paradoxical intention", "dereflection", "meaning in suffering", "Frankl"],
    source: "Man's Search for Meaning — Viktor Frankl",
  },

  // ─── Somatic Psychology & Body-Based Awareness ────────────────────────────
  {
    id: "hpsych-044", domain: "psychology", category: "somatic",
    title: "Body Scanning — Where Do You Feel It?",
    content: "Emotions live in the body before the mind names them. Anxiety = tight chest, shallow breath. Sadness = heavy shoulders, lump in throat. Anger = clenched jaw, hot face. When someone describes an emotion, ask: 'Where do you feel that in your body?' This builds interoception (body awareness) and creates distance from the emotion: 'I notice tightness in my chest' vs 'I am anxious.' The body is the first data point.",
    keywords: ["body scan", "somatic", "interoception", "chest", "shoulders", "breath", "body awareness"],
    source: "Somatic Experiencing — Peter Levine",
  },
  {
    id: "hpsych-045", domain: "psychology", category: "somatic",
    title: "Breath as Regulator — The 4-7-8 Technique",
    content: "Breathing is the only autonomic function we can consciously control. This makes it the bridge between voluntary and involuntary nervous systems. 4-7-8 breathing: inhale 4 counts, hold 7, exhale 8. The extended exhale activates the parasympathetic (rest-and-digest) system. Use when someone is anxious, flooded, or panicking: 'Let's breathe together. In for 4... hold... out for 8.' Three cycles calm the nervous system.",
    keywords: ["breath", "4-7-8", "parasympathetic", "calm", "anxiety", "nervous system", "regulate"],
    source: "The Anxiety and Phobia Workbook — Edmund Bourne",
  },

  // ─── Relationship Psychology (Gottman, Johnson, Perel) ────────────────────
  {
    id: "hpsych-046", domain: "psychology", category: "relationship",
    title: "The Four Horsemen — Relationship Killers",
    content: "Gottman's four predictors of relationship failure: (1) Criticism — attacking character ('You always...', 'You never...'). (2) Contempt — superiority, mockery, eye-rolling (the #1 predictor). (3) Defensiveness — playing victim, counter-attacking. (4) Stonewalling — withdrawing, shutting down. Antidotes: criticism → gentle startup ('I feel X when Y happens'). contempt → build culture of appreciation. defensiveness → take responsibility. stonewalling → self-soothe then re-engage.",
    keywords: ["four horsemen", "criticism", "contempt", "defensiveness", "stonewalling", "Gottman", "relationship"],
    source: "The Seven Principles for Making Marriage Work — John Gottman",
  },
  {
    id: "hpsych-047", domain: "psychology", category: "relationship",
    title: "The Gentle Startup — How to Raise Difficult Topics",
    content: "How a conversation starts predicts how it ends 96% of the time. Gentle startup formula: 'I feel [emotion] about [specific situation] and I need [positive action].' NOT: 'You never listen to me' (criticism). INSTEAD: 'I feel lonely when we don't talk in the evenings, and I need us to have 15 minutes of uninterrupted time together.' Soft start = complaint without blame. Begin with 'I feel', not 'You are'.",
    keywords: ["gentle startup", "complaint", "blame", "I feel", "specific", "need", "conversation"],
    source: "The Seven Principles — John Gottman",
  },
  {
    id: "hpsych-048", domain: "psychology", category: "relationship",
    title: "Repair Attempts — The Secret of Successful Couples",
    content: "Successful relationships aren't conflict-free — they're repair-skilled. A repair attempt is any gesture that de-escalates tension: humor, 'I see your point', 'Let me try again', touch, 'I'm sorry', even a silly face. The key: the other person accepts the repair. When repairs fail repeatedly, resentment builds. Teach: notice when you or they offer repair, and accept it even if you're still upset. 'I appreciate you trying to fix this.'",
    keywords: ["repair", "de-escalate", "humor", "sorry", "accept", "tension", "resentment"],
    source: "The Seven Principles — John Gottman",
  },
  {
    id: "hpsych-049", domain: "psychology", category: "relationship",
    title: "Emotionally Focused Therapy — The Dance of Attachment",
    content: "EFT sees relationship conflict as attachment protest. The pursuer ('Why don't you care?') is really saying 'I'm afraid you don't love me.' The withdrawer ('I can't do anything right') is really saying 'I'm afraid I'll never be enough.' Under every angry protest is a vulnerable attachment fear. Help them hear the fear beneath the anger: 'When you pull away, I feel abandoned' / 'When you criticize, I feel like a failure.'",
    keywords: ["EFT", "attachment protest", "pursuer", "withdrawer", "fear", "vulnerable", "Sue Johnson"],
    source: "Hold Me Tight — Sue Johnson",
  },
  {
    id: "hpsych-050", domain: "psychology", category: "relationship",
    title: "The 5:1 Ratio — Magic of Positive Interactions",
    content: "Gottman's research found stable relationships maintain at least 5 positive interactions for every 1 negative during conflict. Positive interactions: smiles, touches, compliments, laughter, 'I appreciate...', small kindnesses. Negative: criticism, contempt, defensiveness, stonewalling. Below 5:1, the relationship is in trouble. Above 5:1, couples can navigate even serious conflicts. The bank account of positivity must stay funded.",
    keywords: ["5:1 ratio", "positive interactions", "appreciation", "kindness", "bank account", "Gottman"],
    source: "The Seven Principles — John Gottman",
  },

  // ─── Habit Formation & Behavior Change ────────────────────────────────────
  {
    id: "hpsych-051", domain: "psychology", category: "behavior-change",
    title: "The Habit Loop — Cue, Routine, Reward",
    content: "Every habit runs on a loop: Cue (trigger) → Routine (behavior) → Reward (satisfaction). To change a habit, keep the cue and reward, swap the routine. Example: stress (cue) → smoke (routine) → relief (reward). Replace: stress → deep breathing (new routine) → relief. The cue never goes away — you just reroute the response. Identify the cue first: 'What happens right BEFORE the urge?'",
    keywords: ["habit loop", "cue", "routine", "reward", "trigger", "change habit", "urge"],
    source: "The Power of Habit — Charles Duhigg",
  },
  {
    id: "hpsych-052", domain: "psychology", category: "behavior-change",
    title: "Atomic Habits — 1% Improvements Compound",
    content: "Big change doesn't come from big actions — it comes from tiny, consistent improvements. 1% better daily = 37x better in a year. Four laws: (1) Make it obvious (set cues). (2) Make it attractive (pair with something enjoyable). (3) Make it easy (reduce friction, start with 2 minutes). (4) Make it satisfying (immediate reward). Identity-based habits: don't say 'I'm trying to quit smoking' — say 'I'm not a smoker.'",
    keywords: ["atomic habits", "1 percent", "compound", "identity", "tiny", "consistent", "James Clear"],
    source: "Atomic Habits — James Clear",
  },
  {
    id: "hpsych-053", domain: "psychology", category: "behavior-change",
    title: "Stages of Change — The Transtheoretical Model",
    content: "People don't change in a straight line. Five stages: (1) Precontemplation — not even thinking about change. (2) Contemplation — aware of the problem, ambivalent. (3) Preparation — planning to act soon. (4) Action — actively changing behavior. (5) Maintenance — sustaining the change. Relapse is normal, not failure. Match your response to their stage: don't give action advice to someone in contemplation — they need to explore ambivalence first.",
    keywords: ["stages of change", "precontemplation", "contemplation", "preparation", "action", "maintenance", "relapse"],
    source: "Changing for Good — Prochaska, Norcross & DiClemente",
  },

  // ─── Mindfulness & Acceptance-Based Approaches ────────────────────────────
  {
    id: "hpsych-054", domain: "psychology", category: "mindfulness",
    title: "Defusion — You Are Not Your Thoughts",
    content: "ACT technique: thoughts are not facts, they're mental events. Defusion creates distance: instead of 'I'm worthless' → 'I'm having the thought that I'm worthless.' Other techniques: sing the thought in a silly voice, thank your mind for the suggestion ('Thanks, mind!'), label it ('There's the worry thought again'). The goal isn't to stop thoughts — it's to stop being controlled by them.",
    keywords: ["defusion", "thoughts", "distance", "ACT", "label", 'thank your mind', "mental events"],
    source: "The Happiness Trap — Russ Harris",
  },
  {
    id: "hpsych-055", domain: "psychology", category: "mindfulness",
    title: "The Observing Self — Sky and Weather",
    content: "You are the sky. Thoughts and feelings are the weather. Storms come and go, but the sky remains. This metaphor creates psychological flexibility: 'Notice what you're feeling right now. Can you make space for it? You don't have to like it — just let it be there while you focus on what matters.' The observing self is the part of you that notices without judging. Access it with: 'What part of you is watching this experience?'",
    keywords: ["observing self", "sky", "weather", "space", "flexibility", "notice", "ACT"],
    source: "ACT Made Simple — Russ Harris",
  },
  {
    id: "hpsych-056", domain: "psychology", category: "mindfulness",
    title: "Urge Surfing — Riding the Wave Without Acting",
    content: "Urges (to check phone, smoke, eat, lash out, give up) rise like waves: build, peak, then fall — if you don't act on them. Urge surfing: notice the urge ('I'm feeling an urge to...'), rate its intensity (1-10), watch it move through your body, breathe into it, wait for it to peak and subside. Most urges last 15-30 minutes. The more you surf without acting, the weaker the urge becomes over time.",
    keywords: ["urge surfing", "craving", "impulse", "wave", "intensity", "wait", "subside"],
    source: "Mindfulness-Based Relapse Prevention — Bowen, Chawla & Marlatt",
  },

  // ─── Cultural Psychology & Indian Context ─────────────────────────────────
  {
    id: "hpsych-057", domain: "psychology", category: "cultural",
    title: "Joint Family Dynamics — Boundaries in Collective Culture",
    content: "Indian families operate on collectivist values: individual needs are secondary to family harmony. This creates specific tensions: guilt about setting boundaries, in-law conflicts, parental pressure on career/marriage, comparison with cousins/siblings. Validate both the individual's need AND the family bond: 'You can love your family and still need space for your own decisions.' Help them find culturally-grounded boundary language.",
    keywords: ["joint family", "boundaries", "collectivist", "guilt", "in-law", "parental pressure", "Indian"],
    source: "Indian Psychology — Sudhir Kakar",
  },
  {
    id: "hpsych-058", domain: "psychology", category: "cultural",
    title: "Karma and Fatalism — When Spiritual Beliefs Block Agency",
    content: "Some seekers use karma as fatalism: 'It's my destiny, I can't change it.' This is spiritual bypassing — using spiritual ideas to avoid psychological work. Reframe: karma means action and consequence, not helplessness. 'Your past actions created your present situation. Your present actions create your future.' The Gita's teaching: you have the right to action, not to the fruits. Focus on what's in their control now.",
    keywords: ["karma", "fatalism", "destiny", "spiritual bypassing", "agency", "Gita", "action"],
    source: "Bhagavad Gita — Chapter 2, Verse 47",
  },
  {
    id: "hpsych-059", domain: "psychology", category: "cultural",
    title: "Log Kya Kahenge — The Weight of Social Judgment",
    content: "'What will people say?' is one of the most powerful constraints in Indian psychology. Fear of social judgment drives decisions about career, marriage, divorce, mental health treatment. Validate the real social cost while building inner authority: 'It makes sense you worry about what people think — relationships matter. AND you're the one who has to live with this decision.' Help them distinguish between community wisdom and community pressure.",
    keywords: ["log kya kahenge", "social judgment", "shame", "community", "decision", "inner authority"],
    source: "Indian Cultural Psychology",
  },
  {
    id: "hpsych-060", domain: "psychology", category: "cultural",
    title: "Arranged Marriage Psychology — Choice vs Compatibility",
    content: "Arranged marriages involve unique psychological dynamics: family expectations, limited pre-marriage bonding, pressure to 'adjust', fear of disappointing parents. Don't impose Western individualism ('You should marry for love'). Instead: help them clarify what they need in a partnership, communicate those needs to family, and build connection within the structure. 'Compatibility can grow — what matters most to you in a life partner?'",
    keywords: ["arranged marriage", "compatibility", "adjust", "family expectations", "partnership", "Indian marriage"],
    source: "Indian Family Psychology",
  },

  // ─── Crisis Communication & De-escalation ─────────────────────────────────
  {
    id: "hpsych-061", domain: "psychology", category: "crisis",
    title: "Psychological First Aid — The LOOK-LISTEN-LINK Model",
    content: "When someone is in acute distress: LOOK (assess safety, basic needs, severity). LISTEN (approach, ask about needs, help them tell their story — don't interrupt). LINK (provide information, connect to practical support, help with problem-solving). Don't: force them to talk, give false reassurance ('Everything will be fine'), minimize ('Others have it worse'), or pathologize normal reactions to abnormal events.",
    keywords: ["psychological first aid", "crisis", "LOOK LISTEN LINK", "distress", "safety", "support"],
    source: "WHO Psychological First Aid Guide",
  },
  {
    id: "hpsych-062", domain: "psychology", category: "crisis",
    title: "De-escalation — Lower Your Voice, Slow Your Words",
    content: "When someone is angry or panicked: (1) Lower your volume and slow your pace — their nervous system will mirror yours. (2) Validate first: 'I can see this is really important to you.' (3) Don't say 'calm down' (it has the opposite effect). (4) Offer choices: 'Would it help to talk about it, or would you prefer a moment?' (5) Use 'we' language: 'Let's figure this out together.' De-escalation is co-regulation in action.",
    keywords: ["de-escalation", "calm", "angry", "panic", "validate", "choices", "mirror"],
    source: "Crisis Intervention — James & Gilliland",
  },
  {
    id: "hpsych-063", domain: "psychology", category: "crisis",
    title: "Suicidal Ideation — QPR (Question, Persuade, Refer)",
    content: "If someone hints at hopelessness ('What's the point?', 'I can't go on'): ASK directly ('Are you thinking about ending your life?'). Asking does NOT plant the idea — it opens the door. Listen without judgment. Persuade to stay: 'I'm glad you're talking to me. Let's find help together.' Refer to professional resources. Never promise secrecy. Stay with them. The single most protective factor is human connection.",
    keywords: ["suicide", "hopelessness", "QPR", "ask", "listen", "refer", "connection", "crisis"],
    source: "QPR Institute — QPR Suicide Prevention",
  },

  // ─── Depth Psychology & Unconscious Patterns ──────────────────────────────
  {
    id: "hpsych-064", domain: "psychology", category: "depth-psychology",
    title: "Shadow Work — The Parts We Disown",
    content: "The shadow contains everything we've rejected about ourselves: anger, selfishness, vulnerability, desire. It doesn't disappear — it leaks out as projection ('They're so selfish' often means 'I'm afraid I'm selfish'). Shadow integration: when you notice a strong reaction to someone, ask 'What does this person represent that I disown in myself?' Not to act out the shadow, but to acknowledge it. Wholeness > perfection.",
    keywords: ["shadow", "projection", "disown", "parts", "Jung", "wholeness", "integration"],
    source: "Owning Your Own Shadow — Robert Johnson",
  },
  {
    id: "hpsych-065", domain: "psychology", category: "depth-psychology",
    title: "Repetition Compulsion — Why We Recreate Old Patterns",
    content: "Freud noticed: people unconsciously recreate painful relationship patterns. The woman who chooses emotionally unavailable partners like her father. The man who sabotages success like his self-destructive parent. This isn't masochism — it's the psyche trying to MASTER what it couldn't control as a child. Awareness is the first step: 'What pattern keeps repeating in your life? When did you first learn this pattern?'",
    keywords: ["repetition compulsion", "pattern", "unconscious", "recreate", "Freud", "master", "awareness"],
    source: "Beyond the Pleasure Principle — Sigmund Freud",
  },
  {
    id: "hpsych-066", domain: "psychology", category: "depth-psychology",
    title: "Internal Family Systems — The Multiplicity of Mind",
    content: "IFS sees the mind as naturally multiple: we all have 'parts'. The Manager (plans, controls, prevents pain). The Exile (carries old wounds, shame, vulnerability). The Firefighter (reacts when exiles are triggered — numbs, rages, escapes). Healing = building a relationship with each part from the Self (calm, curious, compassionate). 'What part of you feels this way? What does that part need?'",
    keywords: ["IFS", "parts", "manager", "exile", "firefighter", "self", "multiplicity", "Schwartz"],
    source: "Internal Family Systems Therapy — Richard Schwartz",
  },

  // ─── Communication Under Specific Emotional States ────────────────────────
  {
    id: "hpsych-067", domain: "psychology", category: "emotion-specific",
    title: "Responding to Anxiety — Certainty Before Exploration",
    content: "Anxious minds need safety before they can think clearly. Sequence: (1) Ground: 'You're safe right now. Let's take a breath.' (2) Validate: 'It makes sense you'd feel worried about this.' (3) Normalize: 'Many people feel this way when facing the unknown.' (4) Offer certainty: 'Here's what I can tell you for sure...' (5) Then explore: 'Would you like to think through the possibilities?' Never start with exploration for an anxious person.",
    keywords: ["anxiety response", "ground", "certainty", "validate", "normalize", "safe", "breathe"],
    source: "The Anxiety Toolkit — Alice Boyes",
  },
  {
    id: "hpsych-068", domain: "psychology", category: "emotion-specific",
    title: "Responding to Anger — Listen for the Hurt Beneath",
    content: "Anger is almost always a secondary emotion — the primary feeling is hurt, fear, frustration, or powerlessness. Don't match their energy or tell them to calm down. Instead: (1) Let them finish expressing. (2) Lower your voice. (3) Listen for the underlying pain: 'It sounds like you're really hurt by this.' (4) Validate the legitimate need: 'You deserved better.' Anger dissolves when the hurt beneath it is acknowledged.",
    keywords: ["anger response", "hurt", "listen", "underlying", "validate", "secondary emotion", "pain"],
    source: "Nonviolent Communication — Marshall Rosenberg",
  },
  {
    id: "hpsych-069", domain: "psychology", category: "emotion-specific",
    title: "Responding to Sadness — Presence Over Solutions",
    content: "When someone is grieving or deeply sad, resist the urge to cheer them up or offer silver linings. What they need: (1) Presence: 'I'm here with you.' (2) Permission: 'It's okay to feel this way.' (3) Patience: let silence be comfortable. (4) Practical help: 'Is there something I can do right now?' Sadness is not a problem to solve — it's an experience to witness. The deepest comfort is feeling less alone.",
    keywords: ["sadness response", "grief", "presence", "witness", "alone", "permission", "comfort"],
    source: "On Grief and Grieving — Elisabeth Kübler-Ross",
  },
  {
    id: "hpsych-070", domain: "psychology", category: "emotion-specific",
    title: "Responding to Confusion — Simplify, Don't Overwhelm",
    content: "When someone is confused or overwhelmed: (1) Slow down. (2) One thing at a time. (3) Use concrete language, not abstractions. (4) Check understanding: 'Does that make sense so far?' (5) Offer a small next step: 'What's ONE thing you could do today?' Confusion often masks anxiety — the person feels they SHOULD understand but doesn't. Normalize: 'This is a lot to take in. Let's go step by step.'",
    keywords: ["confusion response", "overwhelm", "simplify", "one thing", "concrete", "step by step"],
    source: "Cognitive Load Theory — John Sweller",
  },
  {
    id: "hpsych-071", domain: "psychology", category: "emotion-specific",
    title: "Responding to Hopelessness — Find the Exception",
    content: "When someone says 'Nothing will ever change' or 'There's no point': don't argue ('But things could get better!'). Instead, search for exceptions: 'Has there been even one moment recently when things felt slightly less hopeless?' Solution-focused therapy technique: the exception proves the rule isn't absolute. Then amplify: 'What was different about that moment? What does that tell you about what you need?'",
    keywords: ["hopelessness response", "exception", 'nothing will change', "solution-focused", "amplify", "despair"],
    source: "Solution-Focused Brief Therapy — Steve de Shazer",
  },
  {
    id: "hpsych-072", domain: "psychology", category: "emotion-specific",
    title: "Responding to Guilt — Distinguish Guilt from Shame",
    content: "Guilt = 'I did something bad' (behavior-focused, can lead to repair). Shame = 'I AM bad' (identity-focused, leads to hiding/numbing). When someone expresses guilt: 'What would making amends look like?' — channel toward repair. When someone expresses shame: 'You're not your worst moment. Everyone struggles.' Shame needs compassion. Guilt needs action. The distinction matters enormously for the response.",
    keywords: ["guilt response", "shame", "amends", "repair", "compassion", "identity", "behavior"],
    source: "Daring Greatly — Brené Brown",
  },

  // ─── Trust, Vulnerability & Connection ────────────────────────────────────
  {
    id: "hpsych-073", domain: "psychology", category: "vulnerability",
    title: "Vulnerability is Strength, Not Weakness",
    content: "Brené Brown's research: vulnerability is the birthplace of connection, creativity, and change. People who live wholeheartedly are those who have the courage to be imperfect, to say 'I love you' first, to ask for help. When someone shares something vulnerable, honor it: 'Thank you for trusting me with that.' Don't rush to fix it. Don't minimize ('Oh, everyone feels that way'). Witness it fully.",
    keywords: ["vulnerability", "courage", "connection", "trust", "imperfect", "Brené Brown", "wholehearted"],
    source: "Daring Greatly — Brené Brown",
  },
  {
    id: "hpsych-074", domain: "psychology", category: "vulnerability",
    title: "The Trust Battery — Deposits and Withdrawals",
    content: "Trust works like a bank account. Deposits: keeping promises, being reliable, admitting mistakes, showing up consistently, listening without judgment. Withdrawals: breaking promises, being unreliable, dismissing feelings, gossiping, being inconsistent. Every relationship has a trust balance. Before giving difficult feedback or advice, make sure the balance is high enough to absorb the withdrawal. 'I want to share something honest — is now a good time?'",
    keywords: ["trust battery", "deposits", "withdrawals", "reliable", "promises", "feedback", "balance"],
    source: "The Speed of Trust — Stephen Covey",
  },

  // ─── Sleep, Stress & Physical Foundations ─────────────────────────────────
  {
    id: "hpsych-075", domain: "psychology", category: "foundations",
    title: "Sleep Psychology — The Foundation of Mental Health",
    content: "Poor sleep amplifies every psychological difficulty: anxiety feels worse, emotions are harder to regulate, thinking is foggy. Before deep psychological work, check sleep: 'How are you sleeping?' If poor, address first: consistent schedule, no screens 1 hour before bed, cool dark room, no caffeine after 2pm, wind-down ritual. Sleep hygiene is the cheapest, most effective intervention for overall well-being.",
    keywords: ["sleep", "mental health", "anxiety", "schedule", "screens", "caffeine", "foundation"],
    source: "Why We Sleep — Matthew Walker",
  },
  {
    id: "hpsych-076", domain: "psychology", category: "foundations",
    title: "Stress Response — Fight, Flight, Freeze, Fawn",
    content: "Four stress responses: Fight (anger, control, aggression). Flight (anxiety, overactivity, perfectionism). Freeze (numbness, procrastination, dissociation). Fawn (people-pleasing, can't say no, loses self in others). Each has evolutionary purpose but becomes maladaptive when chronic. Identify which response someone defaults to: 'When you're stressed, do you tend to get angry, get busy, shut down, or try to please everyone?'",
    keywords: ["stress response", "fight", "flight", "freeze", "fawn", "people-pleasing", "chronic stress"],
    source: "What Happened to You? — Bruce Perry & Oprah Winfrey",
  },
  {
    id: "hpsych-077", domain: "psychology", category: "foundations",
    title: "The Stress Bucket — Overflow and Overflow Signs",
    content: "Everyone has a stress bucket — a capacity for handling pressure. When the bucket overflows: irritability, sleep problems, physical symptoms, relationship conflict, poor concentration. Two solutions: (1) Empty the bucket: exercise, talking, creative expression, rest, laughter. (2) Make the bucket bigger: build resilience through self-care, boundaries, support networks, meaning-making. Ask: 'What's in your bucket right now? What can you pour out?'",
    keywords: ["stress bucket", "overflow", "capacity", "resilience", "exercise", "boundaries", "empty"],
    source: "Stress Management — British Psychological Society",
  },

  // ─── Wisdom Traditions & Psychological Integration ────────────────────────
  {
    id: "hpsych-078", domain: "psychology", category: "wisdom-integration",
    title: "The Stoic Dichotomy of Control",
    content: "Epictetus: 'Some things are in our control, others not.' In our control: opinions, pursuits, desires, actions. Not in our control: body, property, reputation, external events. Suffering comes from trying to control what we can't. When someone is distressed, help them sort: 'What part of this is in your control? What part isn't?' Focus energy only on the first. Release the second with acceptance.",
    keywords: ["stoic", "control", "Epictetus", "acceptance", "suffering", "dichotomy", "energy"],
    source: "Enchiridion — Epictetus",
  },
  {
    id: "hpsych-079", domain: "psychology", category: "wisdom-integration",
    title: "Buddhist Psychology — The Three Poisons",
    content: "Three root causes of suffering: attachment/craving (clinging to what we want), aversion (pushing away what we don't want), ignorance (not seeing reality clearly). When someone is stuck, identify which poison dominates: 'Are you clinging to how things should be? Running from something? Or unclear about what's actually happening?' The antidote to all three: mindful awareness — seeing what IS, not what we fear or desire.",
    keywords: ["Buddhist", "three poisons", "attachment", "aversion", "ignorance", "mindful", "awareness"],
    source: "Buddhist Psychology — Dan Siegel",
  },
  {
    id: "hpsych-080", domain: "psychology", category: "wisdom-integration",
    title: "The Serenity Prayer — Wisdom in Three Lines",
    content: "'Grant me the serenity to accept the things I cannot change, courage to change the things I can, and wisdom to know the difference.' This captures the essence of effective psychological work. When advising: help them identify what's changeable (their actions, boundaries, communication) vs what isn't (other people, the past, external events). Channel energy into the first. Find peace with the second.",
    keywords: ["serenity", "accept", "courage", "change", "wisdom", "Reinhold Niebuhr", "prayer"],
    source: "Reinhold Niebuhr",
  },

  // ─── Advanced Conversation Techniques ─────────────────────────────────────
  {
    id: "hpsych-081", domain: "psychology", category: "advanced-techniques",
    title: "Reframing — Changing the Frame Changes the Feeling",
    content: "Reframing = seeing the same situation through a different lens. 'I failed' → 'I learned what doesn't work.' 'They left me' → 'I'm free to find someone who chooses me.' 'I'm too sensitive' → 'I feel things deeply, which is a strength.' Don't dismiss their pain with toxic positivity. Instead, acknowledge the pain AND offer an alternative frame: 'That sounds really painful. I wonder if there's another way to see it...'",
    keywords: ["reframing", "lens", "perspective", "alternative", "toxic positivity", "acknowledge"],
    source: "Reframing — Richard Bandler & John Grinder",
  },
  {
    id: "hpsych-082", domain: "psychology", category: "advanced-techniques",
    title: "Externalizing the Problem — You Are Not the Problem",
    content: "Narrative therapy technique: separate the person from the problem. Instead of 'I am anxious' → 'Anxiety has been visiting you.' Instead of 'I'm depressed' → 'Depression has been weighing on you.' This creates agency: 'When did Anxiety first show up? What does it want you to believe? When have you successfully pushed back?' The person is not the problem — the problem is the problem.",
    keywords: ["externalizing", "narrative therapy", "separate", "anxiety visits", "agency", "White & Epston"],
    source: "Narrative Means to Effective Ends — White & Epston",
  },
  {
    id: "hpsych-083", domain: "psychology", category: "advanced-techniques",
    title: "Scaling Questions — Measuring the Intangible",
    content: "When feelings are vague, make them concrete: 'On a scale of 1-10, how anxious are you feeling right now?' Then: 'What would it take to move from 7 to 6?' This creates actionable steps from overwhelming feelings. Also useful for confidence, motivation, hope. 'How confident are you about this decision?' 'What would increase your confidence by one point?' Scaling turns stuckness into movement.",
    keywords: ["scaling", "1 to 10", "concrete", "measurable", "actionable", "stuckness", "movement"],
    source: "Solution-Focused Brief Therapy — Steve de Shazer",
  },
  {
    id: "hpsych-084", domain: "psychology", category: "advanced-techniques",
    title: "The Miracle Question — Envisioning the Preferred Future",
    content: "'Suppose tonight while you sleep, a miracle happens and your problem is solved. When you wake up, what's the first small sign you'd notice that things are different?' This bypasses problem-analysis and accesses the person's own vision of healing. Their answer reveals what they actually want (not what they think they should want). Follow up: 'What's already happening that's a little bit like the miracle?'",
    keywords: ["miracle question", "preferred future", "envision", "sign", "healing", "want", "solution-focused"],
    source: "Solution-Focused Brief Therapy — Steve de Shazer",
  },
  {
    id: "hpsych-085", domain: "psychology", category: "advanced-techniques",
    title: "Presuppositions — Language That Creates Possibility",
    content: "NLP technique: embed positive assumptions in your language. 'When you find the answer' (presupposes there IS an answer). 'What will you do differently now that you see this?' (presupposes they've gained insight). 'How quickly will things improve?' (presupposes improvement). These aren't manipulative — they create a linguistic environment where change feels possible and expected.",
    keywords: ["presuppositions", "NLP", "language", "possibility", "assume", "insight", "improvement"],
    source: "Frogs into Princes — Bandler & Grinder",
  },

  // ─── Self-Worth & Identity ────────────────────────────────────────────────
  {
    id: "hpsych-086", domain: "psychology", category: "self-worth",
    title: "Core Wounds — The Five Fundamental Fears",
    content: "Jeff Young's schema therapy identifies 18 early maladaptive schemas. The five most common: (1) Abandonment — 'Everyone leaves eventually.' (2) Defectiveness — 'If they really knew me, they'd leave.' (3) Unlovability — 'I'm not worthy of love.' (4) Mistrust — 'People will hurt me if I let them close.' (5) Failure — 'I'll never be good enough.' These schemas activate in relationships and career. Naming the schema is the first step to loosening its grip.",
    keywords: ["core wounds", "schemas", "abandonment", "defectiveness", "unlovability", "mistrust", "failure"],
    source: "Reinventing Your Life — Jeffrey Young",
  },
  {
    id: "hpsych-087", domain: "psychology", category: "self-worth",
    title: "Imposter Syndrome — The Feeling of Being Found Out",
    content: "70% of people experience imposter feelings at some point. Signs: attributing success to luck, fear of being 'found out', overworking to compensate, difficulty accepting compliments, comparing yourself unfavorably to others. Counter with evidence: 'What facts support that you're competent? What would you tell a friend who felt this way?' Normalize: 'The fact that you care about doing good work IS evidence of competence.'",
    keywords: ["imposter syndrome", "found out", "luck", "overworking", "compliments", "evidence", "competence"],
    source: "The Secret Thoughts of Successful Women — Valerie Young",
  },
  {
    id: "hpsych-088", domain: "psychology", category: "self-worth",
    title: "People-Pleasing — The Cost of Always Saying Yes",
    content: "Chronic people-pleasing stems from a core belief: 'My worth depends on what I do for others.' Signs: can't say no, overcommit, resent then comply, lose sense of own preferences, anxiety when disappointing someone. Recovery: practice small 'no's. 'Let me check and get back to you.' Notice the guilt — it's the schema activating, not a moral failing. 'You can disappoint someone and still be a good person.'",
    keywords: ["people-pleasing", "saying yes", "boundaries", "saying no", "guilt", "worth", "overcommit"],
    source: "Not Nice — Aziz Gazipura",
  },

  // ─── Resilience & Post-Traumatic Growth ───────────────────────────────────
  {
    id: "hpsych-089", domain: "psychology", category: "resilience",
    title: "Post-Traumatic Growth — Finding Strength in Suffering",
    content: "After trauma, some people don't just recover — they grow. Five domains of growth: (1) Greater personal strength ('If I survived that, I can handle anything'). (2) Deeper relationships (knowing who shows up). (3) New possibilities (life path shifts). (4) Greater appreciation for life. (5) Spiritual development. This doesn't mean trauma is good — it means humans can find meaning even in suffering. Ask: 'What has this experience taught you about yourself?'",
    keywords: ["post-traumatic growth", "strength", "resilience", "meaning", "growth", "suffering", "survive"],
    source: "What Doesn't Kill Us — Stephen Joseph",
  },
  {
    id: "hpsych-090", domain: "psychology", category: "resilience",
    title: "The Three P's of Resilience — Personalization, Pervasiveness, Permanence",
    content: "Martin Seligman's learned optimism: resilient people explain setbacks differently. (1) Not personal: 'This happened TO me, not because of me.' (2) Not pervasive: 'This is one area, not my whole life.' (3) Not permanent: 'This is temporary, not forever.' When someone catastrophizes, gently challenge each P: 'Is this really your fault? Does it affect everything? Will it always be this way?' Reframe with accuracy, not false positivity.",
    keywords: ["resilience", "three Ps", "personalization", "pervasiveness", "permanence", "optimism", "Seligman"],
    source: "Learned Optimism — Martin Seligman",
  },
  {
    id: "hpsych-091", domain: "psychology", category: "resilience",
    title: "Hardiness — The Commitment-Control-Challenge Mindset",
    content: "Psychological hardiness (Kobasa) has three C's: (1) Commitment — belief that life is meaningful and engagement matters. (2) Control — belief that you can influence outcomes through your actions. (3) Challenge — belief that change is normal and growth comes through difficulty. People with hardiness weather crises better. Build it: 'What matters most to you?' (commitment). 'What CAN you control here?' (control). 'What might you learn?' (challenge).",
    keywords: ["hardiness", "commitment", "control", "challenge", "Kobasa", "resilience", "meaning"],
    source: "The Hardiness Factor — Salvatore Maddi",
  },

  // ─── Emotional Patterns in Specific Life Domains ──────────────────────────
  {
    id: "hpsych-092", domain: "psychology", category: "life-domains",
    title: "Quarter-Life Crisis — The Crisis of Possibility",
    content: "Ages 22-30: 'I should know what I'm doing but I don't.' Pressure to choose career, partner, identity while feeling unready. Comparison with peers (social media amplifies this). The crisis isn't about age — it's about the gap between expectation and reality. Normalize: 'Not knowing at 25 is the norm, not the exception.' Help them define success on their own terms, not society's template.",
    keywords: ["quarter-life crisis", "22-30", "possibility", "comparison", "expectation", "success", "identity"],
    source: "The Quarter-Life Shift — Alexandra Robbins",
  },
  {
    id: "hpsych-093", domain: "psychology", category: "life-domains",
    title: "Mid-Life Reckoning — When Achievement Feels Empty",
    content: "Ages 40-55: 'I achieved what I was supposed to. Why don't I feel fulfilled?' This isn't a crisis — it's a reckoning with meaning. The first half of life builds the ego. The second half asks: 'Is this all there is?' Carl Jung called this individuation — becoming who you actually are beneath the roles. Help them ask: 'What did I want before the world told me what to want? What matters NOW?'",
    keywords: ["mid-life", "reckoning", "achievement", "empty", "meaning", "Jung", "individuation", "fulfillment"],
    source: "The Middle Passage — James Hollis",
  },
  {
    id: "hpsych-094", domain: "psychology", category: "life-domains",
    title: "Parent-Adult Child Dynamics — Rewiring Old Patterns",
    content: "Adult relationships with parents often replay childhood dynamics: the people-pleaser, the rebel, the caretaker, the invisible child. Breaking the pattern requires differentiation: 'I can love my parent AND set boundaries. I can honor them AND make different choices.' Common struggle: guilt about outgrowing family expectations. Reframe: 'Becoming yourself is not betrayal. The healthiest thing you can give your family is a whole you.'",
    keywords: ["parent", "adult child", "differentiation", "boundaries", "guilt", "pattern", "family dynamics"],
    source: "Adult Children of Emotionally Immature Parents — Lindsay Gibson",
  },
  {
    id: "hpsych-095", domain: "psychology", category: "life-domains",
    title: "Career Psychology — The Protean Career",
    content: "Modern careers are protean (shape-shifting): driven by values, not organizational ladders. People change careers 5-7 times. The anxiety isn't about laziness — it's about identity ('Who am I if not my job?'). Help them separate identity from occupation: 'What do you value? What problems do you enjoy solving? Those transfer across careers.' The question isn't 'What do I want to be?' but 'How do I want to spend my energy?'",
    keywords: ["career", "protean", "values", "identity", "change", "energy", "transferable", "purpose"],
    source: "The Protean Career — Douglas Hall",
  },

  // ─── Communication Patterns That Build or Destroy ─────────────────────────
  {
    id: "hpsych-096", domain: "psychology", category: "communication-patterns",
    title: "Bids for Attention — The Micro-Moments That Build Connection",
    content: "Gottman found that couples who stay together turn toward each other's bids 86% of the time. Divorcing couples: 33%. A bid can be: 'Look at this' (sharing experience), 'I had a hard day' (seeking empathy), 'What do you think?' (seeking opinion), 'Can you help me?' (seeking support). Turning toward = acknowledging the bid. The accumulation of these micro-moments IS the relationship. Never ignore a bid.",
    keywords: ["bids", "attention", "turning toward", "micro-moments", "Gottman", "86 percent", "acknowledge"],
    source: "The Relationship Cure — John Gottman",
  },
  {
    id: "hpsych-097", domain: "psychology", category: "communication-patterns",
    title: "The Softened Startup vs Harsh Startup",
    content: "Conversations end in the same tone they begin. Harsh startup: 'You NEVER help around the house!' (criticism + absolute language). Softened startup: 'I'm feeling overwhelmed with the house and I'd really appreciate some help.' Formula: I feel [emotion] about [specific situation] and I need [positive action]. Never start with 'You' (triggers defensiveness). Always start with 'I' (owns your experience).",
    keywords: ["softened startup", "harsh startup", "I feel", "I need", "specific", "tone", "defensiveness"],
    source: "The Seven Principles — John Gottman",
  },
  {
    id: "hpsych-098", domain: "psychology", category: "communication-patterns",
    title: "Flooding — When Emotion Overwhelms Reason",
    content: "Emotional flooding: heart rate above 100bpm, tunnel vision, can't process information, fight-or-flight activated. In this state, productive conversation is IMPOSSIBLE. The only option: take a 20-minute break (minimum time for nervous system to calm). During break: don't rehearse the argument — do something distracting (walk, music, breathing). Return when both can think clearly. 'I'm feeling flooded. Can we pause for 20 minutes?'",
    keywords: ["flooding", "heart rate", "break", "20 minutes", "calm", "nervous system", "pause"],
    source: "The Seven Principles — John Gottman",
  },
  {
    id: "hpsych-099", domain: "psychology", category: "communication-patterns",
    title: "The Repair Checklist — After Every Conflict",
    content: "After a disagreement, repair is essential. Steps: (1) Take responsibility for YOUR part (even if small). (2) Describe what happened without blame. (3) Express how you felt (vulnerability). (4) Acknowledge how the other person felt (empathy). (5) State what you need going forward. (6) Ask what they need. (7) Make a specific plan. Unrepaired conflicts accumulate and erode trust. Repair is not weakness — it's relationship maintenance.",
    keywords: ["repair", "checklist", "responsibility", "vulnerability", "empathy", "plan", "trust"],
    source: "What Makes Love Last? — John Gottman",
  },
  {
    id: "hpsych-100", domain: "psychology", category: "communication-patterns",
    title: "Meta-Communication — Talking About How You Talk",
    content: "The highest-level communication skill: stepping outside the conversation to examine the process itself. 'I notice we keep going in circles. Can we talk about HOW we're talking?' 'When you raise your voice, I shut down. Can we find a different way?' 'I feel like we're both trying to be heard but neither feels listened to.' Meta-communication breaks dysfunctional patterns by making them visible.",
    keywords: ["meta-communication", "process", "circles", "pattern", "visible", "how we talk", "step outside"],
    source: "Pragmatics of Human Communication — Watzlawick, Beavin & Jackson",
  },

  // ─── Advanced Depth Psychology (Jung, Shadow, Individuation) ─────────────
  {
    id: "hpsych-101", domain: "psychology", category: "depth-psychology",
    title: "Shadow Work — What You Hate in Others Is in You",
    content: "Carl Jung's shadow: the parts of yourself you've disowned because they were shamed or punished. When someone triggers intense dislike ('They're so selfish!'), it's often your own disowned selfishness projecting outward. Shadow work: 'What trait in them annoys me most? Do I ever suppress that in myself? Can I reclaim it healthily?' Integration, not elimination. The shadow holds gold — creativity, assertiveness, boundaries.",
    keywords: ["Jung", "Shadow", "projection", "disowned", "trigger", "integrate", "reclaim", "gold"],
    source: "Meeting the Shadow — Connie Zweig & Jeremiah Abrams",
  },
  {
    id: "hpsych-102", domain: "psychology", category: "depth-psychology",
    title: "Individuation — Becoming Who You Truly Are",
    content: "Jung's central concept: the lifelong process of becoming your authentic self. Not the self your parents wanted, society expects, or your ego constructed — your true Self (capital S). Individuation requires: (1) Examining which parts of you are performed vs authentic. (2) Integrating shadow material. (3) Honoring your unique gifts, even if they don't fit the mold. (4) Accepting the tension of opposites within you. The goal: wholeness, not perfection.",
    keywords: ["individuation", "authentic", "Self", "wholeness", "perfection", "tension", "opposites", "unique"],
    source: "Man and His Symbols — Carl Jung",
  },
  {
    id: "hpsych-103", domain: "psychology", category: "depth-psychology",
    title: "Archetypes — Universal Patterns in Every Life",
    content: "Jung identified universal archetypes: the Hero (courage, quest), the Caregiver (nurturing, service), the Seeker (exploration, truth), the Creator (innovation, expression), the Sage (wisdom, reflection), the Lover (connection, intimacy), the Rebel (freedom, revolution). Everyone has dominant archetypes — and repressed ones. When someone feels stuck, ask: 'Which archetype needs expression? Which is being suppressed?' Archetypes reveal life themes.",
    keywords: ["archetype", "Hero", "Caregiver", "Seeker", "Creator", "Sage", "pattern", "theme"],
    source: "The Hero Within — Carol Pearson",
  },
  {
    id: "hpsych-104", domain: "psychology", category: "depth-psychology",
    title: "Synchronicity — Meaningful Coincidences",
    content: "Jung's synchronicity: when external events mirror internal states in meaningful ways (thinking of someone, then they call; dreaming of a solution, then finding it). Not magic — but the psyche's pattern-recognition system surfacing connections. When clients report synchronicities, don't dismiss ('coincidence') or over-mystify ('the universe is telling you...'). Instead: 'What does this pattern mean to you? What is it drawing your attention to?'",
    keywords: ["synchronicity", "coincidence", "pattern", "meaning", "psyche", "attention", "mirror"],
    source: "Synchronicity: An Acausal Connecting Principle — Carl Jung",
  },
  {
    id: "hpsych-105", domain: "psychology", category: "depth-psychology",
    title: "The Persona vs The Self — What's Real?",
    content: "Persona: the mask you wear for the world (professional, polite, competent). Self: who you actually are underneath (messy, complex, contradictory). Most people over-identify with their persona ('I am my job') and disown the rest. When the persona cracks (failure, loss, crisis), the Self emerges — terrifying but necessary. The work: 'Which parts of you are performed? Which parts are hidden? Can you bring them closer together?'",
    keywords: ["persona", "Self", "mask", "real", "performed", "hidden", "crack", "integrate"],
    source: "The Archetypes and the Collective Unconscious — Carl Jung",
  },

  // ─── Existential Psychology (Meaning, Death, Freedom) ────────────────────
  {
    id: "hpsych-106", domain: "psychology", category: "existential",
    title: "The Four Existential Givens — Death, Freedom, Isolation, Meaninglessness",
    content: "Irvin Yalom identified four ultimate concerns: (1) Death — we will die, and we know it. (2) Freedom — we are responsible for our choices; there's no external script. (3) Isolation — we enter existence alone and leave it alone. (4) Meaninglessness — the universe has no inherent meaning; we must create our own. Anxiety often traces back to one of these. Ask: 'What's the deeper fear underneath?'",
    keywords: ["existential", "death", "freedom", "isolation", "meaning", "Yalom", "anxiety", "fear"],
    source: "Existential Psychotherapy — Irvin Yalom",
  },
  {
    id: "hpsych-107", domain: "psychology", category: "existential",
    title: "Meaning-Making — 'What Is This Suffering Asking of Me?'",
    content: "Viktor Frankl's logotherapy: suffering becomes bearable when it has meaning. Not 'Why me?' but 'What is this asking of me?' 'What can I learn?' 'How can I help others with this experience?' Meaning doesn't eliminate pain — it makes pain purposeful. When someone is suffering, don't rush to find meaning ('Look on the bright side!'). First, be with the pain. Then, gently: 'When you look back on this, what do you hope to have learned?'",
    keywords: ["meaning", "suffering", "Frankl", "logotherapy", "purpose", "learn", "pain", "hope"],
    source: "Man's Search for Meaning — Viktor Frankl",
  },
  {
    id: "hpsych-108", domain: "psychology", category: "existential",
    title: "Authenticity vs BadFaith — 'Am I Living My Truth?'",
    content: "Sartre's 'bad faith': living according to others' expectations, denying your own freedom and responsibility. 'I have to stay in this job' (you don't — you're choosing security over fulfillment). 'I can't leave this relationship' (you can — you're choosing familiarity over growth). Authenticity requires: (1) Acknowledging your freedom. (2) Taking responsibility for your choices. (3) Aligning action with values. The question: 'If no one were watching, what would you choose?'",
    keywords: ["authenticity", "bad faith", "Sartre", "freedom", "responsibility", "choice", "values", "truth"],
    source: "Existentialism Is a Humanism — Jean-Paul Sartre",
  },
  {
    id: "hpsych-109", domain: "psychology", category: "existential",
    title: "The Absurd — Finding Joy in a Meaningless Universe",
    content: "Camus' absurd: the tension between our desire for meaning and the universe's silence. His solution? Not despair, but rebellion — creating meaning anyway. 'One must imagine Sisyphus happy.' When someone feels existential dread ('Nothing matters!'), don't argue ('Life has meaning!'). Instead: 'You're right — the universe doesn't hand us meaning. So what meaning do YOU want to create?' Empower them to be the author.",
    keywords: ["absurd", "Camus", "meaning", "rebellion", "create", "author", "despair", "empower"],
    source: "The Myth of Sisyphus — Albert Camus",
  },
  {
    id: "hpsych-110", domain: "psychology", category: "existential",
    title: "Death Awareness — 'If You Had One Year Left...'",
    content: "Death anxiety often masks life dissatisfaction. When someone fears death ('I don't want to die!'), explore: 'If you knew you had one year left, what would you change?' The answer reveals unlived life. Death awareness isn't morbid — it's clarifying. 'Memento mori' (remember you will die) was the Stoics' tool for prioritizing what matters. Gently: 'What would you regret not doing? Let's work backward from there.'",
    keywords: ["death", "mortality", "regret", "prioritize", "clarify", "unlived", "backward", "memento"],
    source: "Staring at the Sun — Irvin Yalom",
  },

  // ─── Somatic Psychology (Body-Based Healing) ─────────────────────────────
  {
    id: "hpsych-111", domain: "psychology", category: "somatic",
    title: "The Body Keeps the Score — Trauma Lives in Tissue",
    content: "Bessel van der Kolk's core insight: trauma isn't just 'in your head' — it's stored in the body as tension, pain, hypervigilance, numbness. Talk therapy alone often fails because it doesn't address the somatic imprint. Body-based approaches: (1) Somatic experiencing — tracking bodily sensations. (2) EMDR — bilateral stimulation to process trauma. (3) Yoga/movement — releasing stored tension. (4) Breathwork — regulating the nervous system. The body must be part of healing.",
    keywords: ["body", "trauma", "somatic", "tension", "tissue", "nervous system", "breath", "movement"],
    source: "The Body Keeps the Score — Bessel van der Kolk",
  },
  {
    id: "hpsych-112", domain: "psychology", category: "somatic",
    title: "Polyvagal Theory — Three Nervous System States",
    content: "Stephen Porges' polyvagal theory: three autonomic states: (1) Ventral vagal (safe/social) — calm, connected, engaged. (2) Sympathetic (fight/flight) — anxious, angry, panicked. (3) Dorsal vagal (freeze/collapse) — numb, shut down, hopeless. Healing requires moving from sympathetic/dorsal back to ventral. Techniques: slow exhale breathing (activates ventral), grounding (5-4-3-2-1 senses), co-regulation (calm presence of another). You can't think your way out — you must feel your way back.",
    keywords: ["polvagal", "nervous system", "ventral", "sympathetic", "dorsal", "freeze", "ground", "co-regulate"],
    source: "The Polyvagal Theory — Stephen Porges",
  },
  {
    id: "hpsych-113", domain: "psychology", category: "somatic",
    title: "Felt Sense — Tracking Body Wisdom",
    content: "Eugene Gendlin's 'felt sense': the body's pre-verbal knowing — that 'gut feeling' or 'heavy chest' or 'tight throat' before you can name it. Accessing it: 'Where do you feel that in your body?' 'What word or image captures that sensation?' 'If that feeling could speak, what would it say?' The felt sense is wiser than the thinking mind. Don't analyze it — befriend it. 'What does your body know that your mind hasn't figured out yet?'",
    keywords: ["felt sense", "body", "wisdom", "gut", "sensation", "pre-verbal", "befriend", "know"],
    source: "Focusing — Eugene Gendlin",
  },
  {
    id: "hpsych-114", domain: "psychology", category: "somatic",
    title: "Somatic Markers — Body Signals Guide Decisions",
    content: "Antonio Damasio's research: decisions aren't purely rational — they're guided by 'somatic markers' (body signals). That 'gut feeling' about a choice? It's your body processing information faster than your mind. When someone is stuck deciding: 'What does your body say? When you think about Option A, what happens in your chest? Option B? Your body is voting — listen to it.' Somatic wisdom complements cognitive analysis.",
    keywords: ["somatic marker", "body", "decision", "gut", "signal", "wisdom", "complement", "vote"],
    source: "Descartes' Error — Antonio Damasio",
  },
  {
    id: "hpsych-115", domain: "psychology", category: "somatic",
    title: "Breath as Regulator — 4-7-8 and Box Breathing",
    content: "Breath is the fastest way to regulate the nervous system. 4-7-8 breathing (inhale 4, hold 7, exhale 8): activates parasympathetic (calm). Box breathing (4-4-4-4): balances sympathetic/parasympathetic (focus). When someone is anxious: 'Let's breathe together. Inhale for 4... hold for 4... exhale for 6.' Don't just suggest it — guide them through it in real time. The co-regulation of your calm presence amplifies the breath's effect.",
    keywords: ["breath", "4-7-8", "box", "regulate", "nervous system", "calm", "guide", "co-regulate"],
    source: "Breath — James Nestor",
  },

  // ─── Internal Family Systems (IFS) — Parts Work ──────────────────────────
  {
    id: "hpsych-116", domain: "psychology", category: "ifs",
    title: "Parts Work — 'Part of Me Wants to, Part of Me Doesn't'",
    content: "Richard Schwartz's IFS: we all have 'parts' — sub-personalities with their own feelings, beliefs, and agendas. 'Part of me wants to quit my job, part of me is terrified.' These aren't contradictions — they're different parts with different concerns. The work: (1) Identify the parts ('Name the part that wants to quit. Name the part that's scared.'). (2) Understand their positive intent (both are trying to protect you). (3) Let the Self (your core wisdom) lead the negotiation.",
    keywords: ["parts", "IFS", "Schwartz", "sub-personality", "contradiction", "intent", "Self", "negotiate"],
    source: "Internal Family Systems Therapy — Richard Schwartz",
  },
  {
    id: "hpsych-117", domain: "psychology", category: "ifs",
    title: "Exiles, Managers, and Firefighters — The Three Part Types",
    content: "IFS identifies three part types: (1) Exiles — young, wounded parts carrying pain ('the part of me that still feels abandoned'). (2) Managers — protective parts trying to prevent exile pain ('the part that perfectionistically plans'). (3) Firefighters — reactive parts that distract from exile pain when it surfaces ('the part that binges TV/food/substances'). Healing: thank the protectors, befriend the exiles, unburden their pain.",
    keywords: ["exile", "manager", "firefighter", "protect", "wound", "distract", "befriend", "unburden"],
    source: "You Are the One You've Been Waiting For — Richard Schwartz",
  },
  {
    id: "hpsych-118", domain: "psychology", category: "ifs",
    title: "The Self — Your Core Wisdom Is Already Whole",
    content: "IFS assumes everyone has a 'Self' — a core of calm, curiosity, compassion, clarity, confidence, courage, creativity, and connectedness (the 8 C's). The Self isn't created — it's uncovered by unburdening exiled parts. When you're stuck: 'Can you access your Self right now? What would your wisest, most compassionate self say to this part of you?' The Self is always available — it's the therapist within.",
    keywords: ["Self", "core", "wisdom", "8 C", "calm", "curiosity", "compassion", "uncover"],
    source: "Many Minds, One Self — Richard Schwartz",
  },
  {
    id: "hpsych-119", domain: "psychology", category: "ifs",
    title: "Unburdening — Releasing the Pain Exiles Carry",
    content: "When an exile is ready (not before), unburdening releases its pain. Steps: (1) Ask the exile: 'What do you carry?' (shame, fear, abandonment). (2) Ask: 'How old are you?' (often a young age). (3) Witness the exile's story with compassion. (4) Ask: 'What do you need to hear?' (often: 'It wasn't your fault. You're safe now.'). (5) Invite the exile to release the burden (visualize it leaving). (6) Celebrate the exile's courage.",
    keywords: ["unburden", "exile", "pain", "witness", "compassion", "release", "celebrate", "courage"],
    source: "No Bad Parts — Richard Schwartz",
  },
  {
    id: "hpsych-120", domain: "psychology", category: "ifs",
    title: "Self-Leadership — Letting Your Core Lead",
    content: "Self-leadership: making decisions from the Self, not from a reactive part. When triggered: 'Which part is activated right now? Is it the anxious part? The angry part? The shut-down part?' Then: 'Can your Self be with that part?' The Self doesn't fight the part — it befriends it. 'Thank you for trying to protect me. I've got this now.' Self-leadership is the ultimate emotional regulation skill.",
    keywords: ["Self-leadership", "decide", "reactive", "triggered", "befriend", "regulate", "thank", "lead"],
    source: "Leading from the Self — Richard Schwartz",
  },

  // ─── Attachment in Adulthood — Beyond Childhood ──────────────────────────
  {
    id: "hpsych-121", domain: "psychology", category: "attachment-adult",
    title: "Earned Secure Attachment — You Can Change Your Style",
    content: "Your attachment style isn't fixed. 'Earned secure' attachment: moving from insecure (anxious/avoidant) to secure through conscious work. How: (1) Identify your attachment patterns ('When I feel abandoned, I protest/pursue' or 'When I feel engulfed, I withdraw'). (2) Understand their origin (childhood adaptations). (3) Practice new responses in safe relationships ('I can ask for what I need without fear'). (4) Grieve what you didn't get. Secure attachment is learnable.",
    keywords: ["earned secure", "change", "style", "pattern", "origin", "practice", "grieve", "learn"],
    source: "Attached — Amir Levine & Rachel Heller",
  },
  {
    id: "hpsych-122", domain: "psychology", category: "attachment-adult",
    title: "Anxious Attachment in Adults — 'Don't Leave Me'",
    content: "Anxious attachment in adults: hypervigilance to rejection, protest behaviors (calling repeatedly, accusing), emotional flooding when partner withdraws. Underneath: 'I'm not enough. They'll abandon me.' The work: (1) Recognize the trigger ('My anxiety is activated'). (2) Selfsoothe before reacting ('I'm safe right now'). (3) Communicate needs directly ('I need reassurance') instead of protesting ('You never care!'). (4) Choose secure partners who respond consistently.",
    keywords: ["anxious", "attachment", "rejection", "protest", "flood", "selfsoothe", "communicate", "secure"],
    source: "Attached — Amir Levine & Rachel Heller",
  },
  {
    id: "hpsych-123", domain: "psychology", category: "attachment-adult",
    title: "Avoidant Attachment in Adults — 'Don't Get Too Close'",
    content: "Avoidant attachment in adults: discomfort with intimacy, deactivating strategies (focusing on partner's flaws, pulling away when things get serious), emotional suppression. Underneath: 'If I need you, I'll be hurt. I'm safer alone.' The work: (1) Recognize the deactivation ('I'm pulling away because I'm scared, not because they're wrong for me'). (2) Practice staying present when the urge to flee arises. (3) Express needs vulnerably ('I'm feeling overwhelmed, but I'm not leaving'). (4) Choose patient partners who don't chase.",
    keywords: ["avoidant", "attachment", "intimacy", "deactivate", "suppress", "stay", "vulnerable", "patient"],
    source: "Attached — Amir Levine & Rachel Heller",
  },
  {
    id: "hpsych-124", domain: "psychology", category: "attachment-adult",
    title: "The Anxious-Avoidant Trap — The Most Common Dysfunctional Dynamic",
    content: "Anxious + avoidant partners create a toxic dance: anxious pursues ('Talk to me!'), avoidant withdraws ('I need space!'). The more anxious pursues, the more avoidant withdraws. The more avoidant withdraws, the more anxious pursues. Breaking the trap: (1) Anxious learns to selfsoothe and communicate needs directly. (2) Avoidant learns to stay present and express care even when overwhelmed. (3) Both recognize the dance and name it: 'We're in the trap right now.'",
    keywords: ["anxious-avoidant", "trap", "pursue", "withdraw", "dance", "selfsoothe", "present", "name"],
    source: "The Anxious-Avoidant Trap — Psychological Dynamics",
  },
  {
    id: "hpsych-125", domain: "psychology", category: "attachment-adult",
    title: "Secure Attachment Behaviors — What Secure People Do",
    content: "Securely attached adults: (1) Communicate needs directly ('I need reassurance' vs testing). (2) Trust their partner's goodwill (assume positive intent). (3) Stay present during conflict (don't flee or flood). (4) Repair after rupture ('I'm sorry I snapped. Can we try again?'). (5) Balance intimacy and autonomy (close but not enmeshed). (6) Regulate their own emotions (don't expect partner to fix them). Secure attachment is a skill set, not a personality trait.",
    keywords: ["secure", "behavior", "communicate", "trust", "present", "repair", "balance", "regulate"],
    source: "Secure Attachment — Behavioral Patterns",
  },

  // ─── Cultural Psychology — Indian Context Deepened ───────────────────────
  {
    id: "hpsych-126", domain: "psychology", category: "cultural-deep",
    title: "Joint Family Dynamics — Loyalty Conflicts",
    content: "Indian joint families create unique loyalty conflicts: 'If I choose my spouse, I'm disrespecting my parents. If I choose my parents, I'm abandoning my spouse.' There's no 'right' answer — only conscious navigation. The work: (1) Acknowledge the bind ('Both loyalties matter'). (2) Identify non-negotiables ('I won't accept disrespect toward my partner'). (3) Create boundaries with love ('I honor you, AND I need to make my own choices'). (4) Accept that someone will be disappointed — and that's okay.",
    keywords: ["family", "loyalty", "conflict", "boundary", "disappoint", "navigate", "honor", "choice"],
    source: "Indian Family Psychology — Joint Family Dynamics",
  },
  {
    id: "hpsych-127", domain: "psychology", category: "cultural-deep",
    title: "Arranged Marriage Psychology — Choice vs Obligation",
    content: "Arranged marriages carry unique psychological dynamics: (1) 'Am I marrying them, or my family's choice?' (autonomy vs duty). (2) 'Do I love them, or will love come later?' (companionate vs passionate love). (3) 'What if I regret this?' (irreversibility anxiety). The work: honor both individual desire and familial wisdom. 'What do YOU want? What does your family want? Where do these align? Where do they conflict?' There's no universal answer — only conscious choice.",
    keywords: ["arranged", "marriage", "choice", "duty", "love", "regret", "align", "conscious"],
    source: "Cross-Cultural Psychology — Arranged Marriage",
  },
  {
    id: "hpsych-128", domain: "psychology", category: "cultural-deep",
    title: "Caste and Class Identity — The Unspoken Hierarchy",
    content: "Caste and class create invisible hierarchies in Indian psychology: (1) Internalized superiority/inferiority ('My caste is higher/lower'). (2) Marriage market pressures ('We only marry within our caste'). (3) Social mobility anxiety ('I've moved up, but will they accept me?'). These dynamics are rarely discussed but deeply felt. The work: name the unspoken ('I notice caste is important in your family. How does that affect you?'). Create space for individual values over inherited hierarchies.",
    keywords: ["caste", "class", "hierarchy", "superiority", "inferiority", "marriage", "mobility", "name"],
    source: "Indian Social Psychology — Caste and Identity",
  },
  {
    id: "hpsych-129", domain: "psychology", category: "cultural-deep",
    title: "Dharma vs Desire — The Eternal Indian Conflict",
    content: "Indian psychology is shaped by the dharma (duty/right action) vs kama (desire/pleasure) tension: 'I want to be an artist, but my family wants me to be an engineer.' 'I want to marry for love, but dharma says I should honor my parents' choice.' There's no resolution — only conscious navigation. The work: 'What does dharma ask of you? What does kama ask? Where do they align? Where do they conflict? What can you live with?' Honor both; choose consciously.",
    keywords: ["dharma", "desire", "kama", "duty", "pleasure", "conflict", "align", "choose"],
    source: "Indian Philosophical Psychology — Dharma and Kama",
  },
  {
    id: "hpsych-130", domain: "psychology", category: "cultural-deep",
    title: "Spiritual Bypassing in Indian Context — 'It's Your Karma'",
    content: "Spiritual bypassing: using spiritual ideas to avoid psychological work. In Indian context: 'It's your karma, accept it' (dismissing agency). 'Everything happens for a reason' (avoiding grief). 'You're too attached, let go' (invalidating legitimate needs). The work: honor spirituality WITHOUT bypassing. 'Your karma may have brought you here, BUT your choices matter now.' 'Everything happens for a reason, AND it's okay to grieve.' 'You're attached, AND your needs are valid.' Both/and, not either/or.",
    keywords: ["spiritual", "bypass", "karma", "reason", "agency", "grieve", "need", "both"],
    source: "Spiritual Bypassing — John Welwood (Indian Context)",
  },

  // ─── Crisis Communication — When Stakes Are High ─────────────────────────
  {
    id: "hpsych-131", domain: "psychology", category: "crisis",
    title: "Psychological First Aid — The SAFER Model",
    content: "In acute crisis (death, accident, assault, sudden loss), use SAFER: (1) Stabilize — 'You're safe right now. I'm here with you.' (2) Acknowledge — 'This is really hard. Your feelings make sense.' (3) Facilitate understanding — 'Let's take this one step at a time. What's the most pressing thing right now?' (4) Encourage coping — 'What has helped you get through hard times before?' (5) Recover/Refer — 'Do you need professional support? I can help you find it.' Don't therapize — stabilize.",
    keywords: ["crisis", "SAFER", "stabilize", "acknowledge", "facilitate", "cope", "recover", "refer"],
    source: "Psychological First Aid — SAFER Model",
  },
  {
    id: "hpsych-132", domain: "psychology", category: "crisis",
    title: "Suicidal Ideation — Ask Directly, Listen Without Panic",
    content: "If someone hints at suicidal thoughts ('I don't want to be here anymore'), ask directly: 'Are you thinking about ending your life?' This doesn't plant the idea — it creates safety for disclosure. If yes: 'Do you have a plan?' (plan = higher risk). 'Have you attempted before?' (history = higher risk). Then: 'I'm glad you told me. You're not alone in this. Let's get you support.' Provide crisis hotline (iCall: 9152987821, Vandrevala: 1860-2662-345). Don't promise secrecy — safety comes first.",
    keywords: ["suicide", "ideation", "plan", "attempt", "direct", "listen", "support", "hotline"],
    source: "Suicide Prevention — QPR Gatekeeper Training",
  },
  {
    id: "hpsych-133", domain: "psychology", category: "crisis",
    title: "Panic Attacks — 'You're Safe. Breathe With Me.'",
    content: "During a panic attack: (1) Name it — 'This is a panic attack. It will pass. You're not dying.' (2) Ground — 'Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste.' (3) Breathe — 'Inhale for 4, hold for 4, exhale for 6. Let's do it together.' (4) Stay — 'I'm here. You're not alone. Take your time.' Don't say 'Calm down' (invalidating). Don't leave (abandoning). Your calm presence is the medicine.",
    keywords: ["panic", "attack", "ground", "breathe", "stay", "calm", "presence", "medicine"],
    source: "Panic Disorder — Cognitive Behavioral Approach",
  },
  {
    id: "hpsych-134", domain: "psychology", category: "crisis",
    title: "Dissociation — 'Come Back to the Present'",
    content: "When someone dissociates (numb, detached, 'not here'): (1) Ground — 'Look around the room. Name 3 things you see.' (2) Orient — 'What's your name? Where are you right now? What's the date?' (3) Sensory — 'Hold something cold. Smell something strong. Stomp your feet.' (4) Reassure — 'You're safe. That was then; this is now. You're here with me.' Don't push for the trauma story — stabilize first. Dissociation means the nervous system has checked out; bring it back gently.",
    keywords: ["dissociate", "numb", "ground", "orient", "sensory", "safe", "stabilize", "gentle"],
    source: "Dissociation — Trauma Psychology",
  },
  {
    id: "hpsych-135", domain: "psychology", category: "crisis",
    title: "Emotional Flashback — 'That Was Then. This Is Now.'",
    content: "Emotional flashback: sudden re-experiencing of past trauma emotions (fear, shame, abandonment) without the original context. The person feels like a child again. The work: (1) Name it — 'This is a flashback. You're not back there. You're here with me.' (2) Orient — 'Look around. What year is it? Where are you? Who are you with?' (3) Soothe — 'You're safe now. I'm here. That was then; this is now.' (4) Integrate — 'What did that child need to hear? Can you say it to yourself now?'",
    keywords: ["flashback", "trauma", "then", "now", "name", "orient", "soothe", "integrate"],
    source: "Complex PTSD — Emotional Flashbacks",
  },

  // ─── Behavioral Change Science ───────────────────────────────────────────
  {
    id: "hpsych-136", domain: "psychology", category: "behavioral-change",
    title: "The Transtheoretical Model — Stages of Change",
    content: "People change in stages: (1) Precontemplation — not thinking about change ('I don't have a problem'). (2) Contemplation — aware but ambivalent ('Maybe I should, but...'). (3) Preparation — planning to act ('I'll start next week'). (4) Action — actively changing ('I'm doing it!'). (5) Maintenance — sustaining change ('I've been doing this for 6 months'). (6) Relapse — returning to old patterns ('I fell off the wagon'). Match your response to their stage. Don't push action on contemplators.",
    keywords: ["stage", "change", "contemplate", "prepare", "action", "maintain", "relapse", "match"],
    source: "Changing for Good — Prochaska, Norcross, DiClemente",
  },
  {
    id: "hpsych-137", domain: "psychology", category: "behavioral-change",
    title: "Motivational Interviewing — Evoking Their Own Motivation",
    content: "MI spirit: (1) Collaboration — 'We're figuring this out together.' (2) Evocation — 'You already know what you need; I'm just helping you hear it.' (3) Autonomy — 'It's your choice. I trust you to decide.' Key skills: (1) Open questions ('What matters most to you?'). (2) Affirmations ('You've shown real courage coming here.'). (3) Reflections ('So part of you wants to stay, part wants to leave.'). (4) Summaries ('Let me tie together what you've said...'). Don't advise — evoke.",
    keywords: ["MI", "collaboration", "evocation", "autonomy", "open", "affirm", "reflect", "summarize"],
    source: "Motivational Interviewing — Miller & Rollnick",
  },
  {
    id: "hpsych-138", domain: "psychology", category: "behavioral-change",
    title: "The Readiness Ruler — 'On a Scale of 1-10...'",
    content: "When someone is ambivalent: 'On a scale of 1-10, how ready are you to make this change?' If they say 6: 'Why a 6 and not a 3?' (This evokes change talk — they argue FOR change.) 'What would it take to move from 6 to 7?' (This explores next steps without pressure.) The ruler externalizes the internal conflict and makes it discussable. It also reveals that readiness isn't binary — it's a spectrum.",
    keywords: ["ruler", "scale", "ready", "ambivalent", "evocation", "spectrum", "binary", "discuss"],
    source: "Motivational Interviewing — Readiness Ruler",
  },
  {
    id: "hpsych-139", domain: "psychology", category: "behavioral-change",
    title: "Decisional Balance — Pros and Cons of Changing",
    content: "When someone is stuck: 'Let's look at both sides. What are the pros of staying as you are? The cons? What are the pros of changing? The cons?' This isn't about convincing them to change — it's about clarifying their own ambivalence. Often, they already know the answer; they just need to hear themselves say it. The work: reflect without judgment. 'So the pros of staying are X, Y, Z. The cons are A, B, C. What does that tell you?'",
    keywords: ["decisional", "balance", "pros", "cons", "ambivalent", "clarify", "reflect", "judge"],
    source: "Decisional Balance — Motivational Interviewing",
  },
  {
    id: "hpsych-140", domain: "psychology", category: "behavioral-change",
    title: "Tiny Habits — 'After I ___, I Will ___'",
    content: "BJ Fogg's tiny habits: behavior change succeeds when it's (1) easy, (2) specific, (3) tied to an existing routine. Formula: 'After I [existing habit], I will [tiny new habit].' Example: 'After I brush my teeth, I will do 2 push-ups.' The key: make it so small you can't fail. Success builds momentum. Don't start with 'I'll meditate for 30 minutes' — start with 'I'll take one conscious breath after I wake up.' Tiny wins compound.",
    keywords: ["tiny", "habit", "easy", "specific", "routine", "small", "success", "compound"],
    source: "Tiny Habits — BJ Fogg",
  },

  // ─── Positive Psychology — Beyond Pathology ──────────────────────────────
  {
    id: "hpsych-141", domain: "psychology", category: "positive-psychology",
    title: "PERMA — The Five Pillars of Flourishing",
    content: "Martin Seligman's PERMA model: (1) Positive emotions — joy, gratitude, hope. (2) Engagement — flow states, being fully absorbed. (3) Relationships — deep connection, belonging. (4) Meaning — purpose larger than self. (5) Achievement — mastery, accomplishment. Flourishing isn't just 'not depressed' — it's active cultivation of all five. When someone is stuck: 'Which pillar feels most neglected? Let's start there.' Small investments in each compound into well-being.",
    keywords: ["PERMA", "flourish", "positive", "engage", "relationship", "meaning", "achieve", "cultivate"],
    source: "Flourish — Martin Seligman",
  },
  {
    id: "hpsych-142", domain: "psychology", category: "positive-psychology",
    title: "Character Strengths — What's Right With You",
    content: "VIA Institute identified 24 character strengths: creativity, curiosity, judgment, love of learning, perspective, bravery, perseverance, honesty, zest, love, kindness, social intelligence, fairness, leadership, teamwork, forgiveness, humility, prudence, self-regulation, appreciation of beauty, gratitude, hope, humor, spirituality. Everyone has signature strengths (top 5). Using them daily increases well-being. Ask: 'What are your strengths? How are you using them? How could you use them more?'",
    keywords: ["strength", "character", "VIA", "signature", "well-being", "use", "daily", "increase"],
    source: "Character Strengths and Virtues — Peterson & Seligman",
  },
  {
    id: "hpsych-143", domain: "psychology", category: "positive-psychology",
    title: "Flow — The Optimal Experience",
    content: "Mihaly Csikszentmihalyi's flow: state of complete absorption in an activity. Conditions: (1) Clear goals. (2) Immediate feedback. (3) Balance between challenge and skill (not too easy, not too hard). (4) Sense of control. (5) Loss of self-consciousness. (6) Distorted sense of time. Flow is the opposite of anxiety/boredom. When someone is stuck: 'When do you lose track of time? What activities make you feel most alive? How can you create more of that?'",
    keywords: ["flow", "absorb", "challenge", "skill", "control", "time", "alive", "create"],
    source: "Flow — Mihaly Csikszentmihalyi",
  },
  {
    id: "hpsych-144", domain: "psychology", category: "positive-psychology",
    title: "Learned Optimism — How to Not Be a Pessimist",
    content: "Martin Seligman's learned optimism: pessimists explain setbacks as permanent ('It will always be this way'), pervasive ('Everything is ruined'), and personal ('It's all my fault'). Optimists explain them as temporary ('This will pass'), specific ('This one thing went wrong'), and external ('The situation was difficult'). You can teach optimistic explanatory style. When someone catastrophizes: 'Is this permanent, or will it change? Is this everything, or just one thing? Is this all your fault, or were there other factors?'",
    keywords: ["optimism", "pessimism", "permanent", "temporary", "pervasive", "specific", "personal", "external"],
    source: "Learned Optimism — Martin Seligman",
  },
  {
    id: "hpsych-145", domain: "psychology", category: "positive-psychology",
    title: "Gratitude — The Most Researched Well-Being Intervention",
    content: "Gratitude practices increase well-being by 25% (research-backed): (1) Three good things — write down three good things that happened today and why. (2) Gratitude visit — write a letter to someone you're grateful to and read it to them. (3) Mental subtraction — imagine life without a positive event that occurred. Gratitude isn't toxic positivity ('Just be grateful!') — it's noticing what's good alongside what's hard. 'Even in this difficult time, what are you grateful for?'",
    keywords: ["gratitude", "well-being", "three good things", "letter", "subtraction", "notice", "hard", "good"],
    source: "Thanks! — Robert Emmons",
  },

  // ─── Wisdom Traditions — Timeless Psychological Insights ─────────────────
  {
    id: "hpsych-146", domain: "psychology", category: "wisdom",
    title: "The Stoic Dichotomy of Control — 'Is This Up to Me?'",
    content: "Epictetus: 'Some things are up to us, some are not.' Up to us: our judgments, impulses, desires, actions. Not up to us: our body, property, reputation, external events. Suffering comes from trying to control what we can't. The practice: when distressed, ask 'Is this up to me?' If yes, act. If no, accept. 'Grant me the serenity to accept the things I cannot change, courage to change the things I can, and wisdom to know the difference.' (Reinhold Niebuhr)",
    keywords: ["Stoic", "control", "Epictetus", "accept", "act", "serenity", "courage", "wisdom"],
    source: "Enchiridion — Epictetus",
  },
  {
    id: "hpsych-147", domain: "psychology", category: "wisdom",
    title: "Buddhist Psychology — The Four Noble Truths (Applied)",
    content: "Buddha's Four Noble Truths: (1) Dukkha — suffering exists (life is inherently unsatisfactory). (2) Samudaya — suffering has a cause (craving/attachment). (3) Nirodha — suffering can end (letting go). (4) Magga — there's a path (Eightfold Path: right view, intention, speech, action, livelihood, effort, mindfulness, concentration). Applied: 'What are you craving? What are you attached to? What would it feel like to let go? What small step on the path can you take today?'",
    keywords: ["Buddhist", "Four Noble", "suffering", "craving", "attachment", "let go", "path", "step"],
    source: "Buddhist Psychology — The Four Noble Truths",
  },
  {
    id: "hpsych-148", domain: "psychology", category: "wisdom",
    title: "The Bhagavad Gita — 'You Have a Right to Your Actions, But Not to Their Fruits'",
    content: "Krishna's teaching to Arjuna: 'Karmanye vadhikaraste ma phaleshu kadachana' — you have the right to work, but never to the fruits of work. Applied: do your best, then release attachment to the outcome. Anxiety comes from obsessing over results ('What if I fail?'). Peace comes from focusing on effort ('I'll do my best; the rest is not up to me.'). When someone is outcome-obsessed: 'What's the most important action you can take right now? Let's focus on that.'",
    keywords: ["Gita", "Krishna", "action", "fruit", "effort", "outcome", "anxiety", "peace"],
    source: "Bhagavad Gita — Chapter 2, Verse 47",
  },
  {
    id: "hpsych-149", domain: "psychology", category: "wisdom",
    title: "Mindfulness — 'Be Here Now' (Without the Woo-Woo)",
    content: "Mindfulness: paying attention to the present moment, on purpose, without judgment (Jon Kabat-Zinn). It's not meditation — it's a way of being. Applied: (1) Notice when your mind wanders ('I'm planning, not listening'). (2) Gently bring it back ('Right now, I'm here'). (3) Observe without reacting ('I notice anxiety arising. I don't have to act on it.'). (4) Accept what is ('This is how I feel right now. That's okay.'). Mindfulness is meta-cognition — thinking about thinking.",
    keywords: ["mindful", "present", "attention", "judge", "wander", "observe", "accept", "meta"],
    source: "Wherever You Go, There You Are — Jon Kabat-Zinn",
  },
  {
    id: "hpsych-150", domain: "psychology", category: "wisdom",
    title: "The Tao of Conversation — 'The Best Speaker Listens'",
    content: "Lao Tzu: 'The best speaker is known for respecting the spoken word. The best listener is known for respecting silence.' Applied: (1) Speak only when it improves upon the silence. (2) Listen to understand, not to respond. (3) Ask more than you tell. (4) Be comfortable with pauses — they're not empty, they're pregnant. (5) Let the other person find their own truth — don't impose yours. The Tao of conversation: less is more. Silence is golden. Listening is leadership.",
    keywords: ["Tao", "listen", "speak", "silence", "pause", "ask", "truth", "less"],
    source: "Tao Te Ching — Lao Tzu",
  },
];
