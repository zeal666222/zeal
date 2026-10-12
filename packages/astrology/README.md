# @zeal/astrology

Deterministic astrology calculation engine for the Zeal platform. Computes Vedic, Western, and Chinese (BaZi) astrology charts with structured JSON output designed for LLM interpretation.

## Features

### Vedic Astrology (Jyotish)
- **Rashi (D1)** - Natal chart using sidereal zodiac with Lahiri ayanamsa
- **Navamsa (D9)** - Divisional chart for marriage and dharma
- **Divisional Charts (D2-D60)** - All 16 traditional varga charts
- **Vimshottari Dasha** - 120-year planetary period system with Mahadasha/Antardasha
- **Panchanga** - Tithi, Nakshatra, Yoga, Karana
- **Shadbala** - Six-fold planetary strength calculation
- **Ashtakavarga** - Eight-fold strength matrix with Sarvashtakavarga
- **Gochara (Transit)** - Current transits relative to natal chart

### Western Astrology
- **Natal Chart** - Tropical zodiac with multiple house systems (Placidus, Whole Sign, Koch, Equal)
- **Transits** - Current planetary positions and aspects to natal chart
- **Secondary Progressions** - Day=year progressed chart
- **Synastry** - Relationship chart comparison with inter-chart aspects

### Chinese Astrology
- **BaZi (Four Pillars)** - Year/Month/Day/Hour pillars with Heavenly Stems and Earthly Branches
- **Ten Gods** - Relationship analysis relative to Day Master
- **Luck Pillars** - 10-year life cycles

## Installation

```bash
npm install @zeal/astrology
```

## Usage

```typescript
import {
  computeRashiChart,
  computeWesternNatalChart,
  computeFourPillars,
  computeVimshottariDasha,
} from "@zeal/astrology";

// Vedic Rashi chart
const vedicChart = computeRashiChart({
  birthDate: "1869-10-02",
  birthTime: "19:00",
  birthPlace: { lat: 21.6417, lng: 69.6033 },
});

// Western natal chart
const westernChart = computeWesternNatalChart(
  {
    birthDate: "1869-10-02",
    birthTime: "19:00",
    birthPlace: { lat: 21.6417, lng: 69.6033 },
  },
  "placidus"
);

// Chinese BaZi
const bazi = computeFourPillars({
  birthDate: "1869-10-02",
  birthTime: "19:00",
  birthPlace: { lat: 21.6417, lng: 69.6033 },
});

// Vimshottari Dasha
const dasha = computeVimshottariDasha({
  birthDate: "1869-10-02",
  birthTime: "19:00",
  birthPlace: { lat: 21.6417, lng: 69.6033 },
});
```

## Architecture

### Ephemeris Engine
Currently uses `astronomy-engine` (pure JavaScript, MIT license) for planetary position calculations. This provides good accuracy for most applications. For sub-arcsecond precision, the architecture supports swapping in Swiss Ephemeris WASM (`@fusionstrings/swiss-eph`) in the future.

### Ayanamsa
Default: Lahiri ayanamsa (most widely used in India). Also supports Raman and Krishnamurti ayanamsas.

### House Systems
- **Vedic**: Whole Sign (default)
- **Western**: Placidus (default), Whole Sign, Koch, Equal

## Accuracy Notes

- Planetary positions: ~1 arcminute accuracy with astronomy-engine
- House cusps: ~0.5 degree accuracy (simplified Placidus/Koch)
- Dasha timing: Accurate to within a few days
- BaZi pillars: Accurate for standard dates

## Testing

```bash
cd packages/astrology
npm test
```

Uses Gandhi's birth data (1869-10-02, 19:00, Porbandar, India) for validation:
- Sun in Virgo (Vedic) / Libra (Western)
- Moon in Pisces (Vedic) / Aries (Western)

## Cloudflare Worker Compatibility

The package is designed to be deployable on Cloudflare Workers. It uses pure JavaScript computation with no native dependencies, making it WASM-compatible.
