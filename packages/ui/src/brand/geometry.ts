// ═══════════════════════════════════════════════════════════════════════════════
// Zeal brand geometry — one source of truth for the mark, in a 48×48 chart box
// ═════════════════════════════════════════════════════════════════════════──────
// Everything here is computed at module load from pure math, so the server and
// the client emit byte-identical path strings (no hydration drift) and the
// favicon, the header lockup and the dock orb all read the same numbers.
// ═══════════════════════════════════════════════════════════════════════════════

const CX = 24;
const CY = 24;

const n = (v: number) => Number(v.toFixed(2));

/** Angle is measured from 12 o'clock, clockwise — the way a chart wheel is read. */
function polar(radius: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [n(CX + radius * Math.cos(a)), n(CY + radius * Math.sin(a))];
}

export const WHEEL = {
  ring: 21.6,
  tickMinorInner: 20.8,
  tickMinorOuter: 22.6,
  tickCardinalInner: 20.1,
  tickCardinalOuter: 23.3,
  aspect: 18,
} as const;

// The sun's traced path: the summer arc, the equinox diagonal, the winter arc.
// Four equal "M/L" commands, the same command sequence every morph frame uses.
export const SUN_PATH = "M 13 16 L 35 16 L 13 32 L 35 32";

// 12 houses, with the four cardinal axes struck longer.
export const TICK_DIAL = Array.from({ length: 12 }, (_, i) => {
  const deg = i * 30;
  const cardinal = i % 3 === 0;
  const [x1, y1] = polar(cardinal ? WHEEL.tickCardinalInner : WHEEL.tickMinorInner, deg);
  const [x2, y2] = polar(cardinal ? WHEEL.tickCardinalOuter : WHEEL.tickMinorOuter, deg);
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}).join(" ");

// Every aspect frame is built from exactly 12 vertices so SMIL can interpolate
// vertex-for-vertex — no command-count mismatch, no `d="undefined"` artifacts.
function polygon(sides: number, radius: number): string {
  const per = 12 / sides;
  const pts: Array<[number, number]> = [];
  for (let s = 0; s < sides; s++) {
    const [ax, ay] = polar(radius, (360 / sides) * s);
    const [bx, by] = polar(radius, (360 / sides) * (s + 1));
    for (let k = 0; k < per; k++) {
      const t = k / per;
      pts.push([n(ax + (bx - ax) * t), n(ay + (by - ay) * t)]);
    }
  }
  return `M ${pts.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
}

function sixPointStar(outer: number, inner: number): string {
  const pts = Array.from({ length: 12 }, (_, i) =>
    polar(i % 2 === 0 ? outer : inner, i * 30),
  );
  return `M ${pts.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
}

export const ASPECTS = {
  trikona: polygon(3, WHEEL.aspect),
  shadaspatha: sixPointStar(WHEEL.aspect, WHEEL.aspect * 0.52),
  chaturbhuj: polygon(4, WHEEL.aspect),
} as const;

export const ASPECT_CYCLE =
  `${ASPECTS.trikona}; ${ASPECTS.shadaspatha}; ${ASPECTS.chaturbhuj}; ${ASPECTS.trikona}`;

// Non-harmonic periods: the three grahas never return to the same configuration.
export const GRAHAS = [
  { radius: WHEEL.ring, size: 1.1, dur: "21s", fill: "gold", delay: "0s" },
  { radius: 18.4, size: 0.85, dur: "34s", fill: "light", delay: "-6s" },
  { radius: 22.6, size: 0.65, dur: "57s", fill: "core", delay: "-13s" },
] as const;
