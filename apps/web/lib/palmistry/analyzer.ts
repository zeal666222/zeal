// apps/web/lib/palmistry/analyzer.ts
// Industry-grade client-side palm image analysis using Canvas API
// Multi-scale edge detection, directional analysis, curvature measurement

import type {
  HandSide, HandElement, FingerShape,
  LineAnalysis, LineQuality, LineCurvature,
  MountAnalysis, MountDevelopment, MountName,
  HandShapeAnalysis, PalmAnalysisResult,
} from "./types";
import { MOUNT_KNOWLEDGE } from "./knowledge";

// ─── IMAGE PROCESSING PIPELINE ─────────────────────────────────────────────────

function toGrayscale(ctx: CanvasRenderingContext2D, w: number, h: number): Uint8Array {
  const img = ctx.getImageData(0, 0, w, h);
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    const r = img.data[o] ?? 0;
    const g = img.data[o + 1] ?? 0;
    const b = img.data[o + 2] ?? 0;
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

function histogramEqualize(src: Uint8Array): Uint8Array {
  const hist = new Int32Array(256);
  for (let i = 0; i < src.length; i++) {
    const v = src[i] ?? 0;
    hist[v] = (hist[v] ?? 0) + 1;
  }
  const cdf = new Int32Array(256);
  cdf[0] = hist[0]!;
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1]! + hist[i]!;
  const cdfMin = cdf.find((v) => v > 0) ?? 0;
  const total = src.length;
  const range = total - cdfMin;
  const out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const v = src[i] ?? 0;
    out[i] = range > 0 ? Math.round(((cdf[v]! - cdfMin) / range) * 255) : v;
  }
  return out;
}

function gaussianBlur(src: Uint8Array, w: number, h: number): Uint8Array {
  const dst = new Uint8Array(w * h);
  const kernel = [1, 4, 6, 4, 1, 4, 16, 24, 16, 4, 6, 24, 36, 24, 6, 4, 16, 24, 16, 4, 1, 4, 6, 4, 1];
  const kSum = 256;
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      let sum = 0;
      let ki = 0;
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          sum += (src[(y + ky) * w + (x + kx)] ?? 0) * kernel[ki]!;
          ki++;
        }
      }
      dst[y * w + x] = Math.min(255, sum / kSum);
    }
  }
  return dst;
}

function sobelEdgeDetect(gray: Uint8Array, w: number, h: number): { magnitude: Uint8Array; direction: Float32Array } {
  const mag = new Uint8Array(w * h);
  const dir = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = gray[(y - 1) * w + (x - 1)] ?? 0;
      const tc = gray[(y - 1) * w + x] ?? 0;
      const tr = gray[(y - 1) * w + (x + 1)] ?? 0;
      const ml = gray[y * w + (x - 1)] ?? 0;
      const mr = gray[y * w + (x + 1)] ?? 0;
      const bl = gray[(y + 1) * w + (x - 1)] ?? 0;
      const bc = gray[(y + 1) * w + x] ?? 0;
      const br = gray[(y + 1) * w + (x + 1)] ?? 0;

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const idx = y * w + x;
      mag[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      dir[idx] = Math.atan2(gy, gx);
    }
  }
  return { magnitude: mag, direction: dir };
}

function nonMaxSuppression(mag: Uint8Array, dir: Float32Array, w: number, h: number): Uint8Array {
  const suppressed = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const angle = ((dir[idx]! * 180) / Math.PI + 180) % 180;
      const m = mag[idx]!;
      let n1 = 0, n2 = 0;
      if (angle < 22.5 || angle >= 157.5) {
        n1 = mag[y * w + (x + 1)] ?? 0;
        n2 = mag[y * w + (x - 1)] ?? 0;
      } else if (angle < 67.5) {
        n1 = mag[(y - 1) * w + (x + 1)] ?? 0;
        n2 = mag[(y + 1) * w + (x - 1)] ?? 0;
      } else if (angle < 112.5) {
        n1 = mag[(y - 1) * w + x] ?? 0;
        n2 = mag[(y + 1) * w + x] ?? 0;
      } else {
        n1 = mag[(y - 1) * w + (x - 1)] ?? 0;
        n2 = mag[(y + 1) * w + (x + 1)] ?? 0;
      }
      suppressed[idx] = (m >= n1 && m >= n2) ? m : 0;
    }
  }
  return suppressed;
}

function hysteresisThreshold(suppressed: Uint8Array, w: number, h: number, low: number, high: number): Uint8Array {
  const result = new Uint8Array(w * h);
  const STRONG = 255;
  const WEAK = 128;
  for (let i = 0; i < suppressed.length; i++) {
    const v = suppressed[i] ?? 0;
    if (v >= high) result[i] = STRONG;
    else if (v >= low) result[i] = WEAK;
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (result[idx] === WEAK) {
          const hasStrong =
            result[idx - 1] === STRONG || result[idx + 1] === STRONG ||
            result[idx - w] === STRONG || result[idx + w] === STRONG ||
            result[idx - w - 1] === STRONG || result[idx - w + 1] === STRONG ||
            result[idx + w - 1] === STRONG || result[idx + w + 1] === STRONG;
          if (hasStrong) { result[idx] = STRONG; changed = true; }
          else result[idx] = 0;
        }
      }
    }
  }
  for (let i = 0; i < result.length; i++) {
    result[i] = result[i] === STRONG ? 255 : 0;
  }
  return result;
}

function laplacianSharpen(gray: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = (gray[y * w + x] ?? 0) * 4;
      const t = gray[(y - 1) * w + x] ?? 0;
      const b = gray[(y + 1) * w + x] ?? 0;
      const l = gray[y * w + (x - 1)] ?? 0;
      const r = gray[y * w + (x + 1)] ?? 0;
      out[y * w + x] = Math.min(255, Math.max(0, c - t - b - l - r + 128));
    }
  }
  return out;
}

// ─── DIRECTIONAL LINE ANALYSIS ──────────────────────────────────────────────────

interface DirectionalMetrics {
  horizontalDensity: number;
  verticalDensity: number;
  diagonalDensity: number;
  dominantDirection: "horizontal" | "vertical" | "diagonal" | "mixed";
}

function analyzeDirectionality(edges: Uint8Array, dir: Float32Array, region: PalmRegion, fullWidth: number, fullHeight: number): DirectionalMetrics {
  let hCount = 0, vCount = 0, dCount = 0, total = 0;
  const yEnd = Math.min(region.y + region.h, fullHeight);
  const xEnd = Math.min(region.x + region.w, fullWidth);

  for (let y = region.y; y < yEnd; y++) {
    for (let x = region.x; x < xEnd; x++) {
      const idx = y * fullWidth + x;
      if ((edges[idx] ?? 0) > 0) {
        total++;
        const angle = Math.abs(((dir[idx] ?? 0) * 180) / Math.PI);
        if (angle < 30 || angle > 150) vCount++;
        else if (angle > 60 && angle < 120) hCount++;
        else dCount++;
      }
    }
  }

  const area = Math.max(1, region.w * region.h);
  const hD = hCount / area;
  const vD = vCount / area;
  const dD = dCount / area;
  const maxD = Math.max(hD, vD, dD);
  const domDir: DirectionalMetrics["dominantDirection"] =
    total === 0 ? "mixed" :
    maxD === hD && hD > vD * 1.5 ? "horizontal" :
    maxD === vD && vD > hD * 1.5 ? "vertical" :
    dD > hD && dD > vD ? "diagonal" : "mixed";

  return { horizontalDensity: hD, verticalDensity: vD, diagonalDensity: dD, dominantDirection: domDir };
}

// ─── CURVATURE MEASUREMENT ──────────────────────────────────────────────────────

interface CurvatureMetrics {
  avgTurningAngle: number;
  curvatureScore: number;
  segments: number;
}

function measureCurvature(edges: Uint8Array, region: PalmRegion, fullWidth: number, fullHeight: number): CurvatureMetrics {
  const yEnd = Math.min(region.y + region.h, fullHeight);
  const xEnd = Math.min(region.x + region.w, fullWidth);
  const step = Math.max(2, Math.floor(region.w / 20));
  let totalAngle = 0;
  let segments = 0;

  for (let y = region.y + 2; y < yEnd - 2; y += step) {
    const points: Array<{ x: number; y: number }> = [];
    for (let x = region.x; x < xEnd - 1; x += 2) {
      if ((edges[y * fullWidth + x] ?? 0) > 0) {
        points.push({ x, y });
        if (points.length >= 3) break;
      }
    }
    if (points.length >= 3) {
      const dx1 = points[1]!.x - points[0]!.x;
      const dy1 = points[1]!.y - points[0]!.y;
      const dx2 = points[2]!.x - points[1]!.x;
      const dy2 = points[2]!.y - points[1]!.y;
      const cross = dx1 * dy2 - dy1 * dx2;
      const dot = dx1 * dx2 + dy1 * dy2;
      totalAngle += Math.abs(Math.atan2(cross, dot));
      segments++;
    }
  }

  const avgAngle = segments > 0 ? totalAngle / segments : 0;
  const curvatureScore = Math.min(1, avgAngle / (Math.PI / 4));

  return { avgTurningAngle: avgAngle, curvatureScore, segments };
}

// ─── BRANCH & ISLAND DETECTION ──────────────────────────────────────────────────

interface FeatureMetrics {
  branchPoints: number;
  islandRegions: number;
  gapCount: number;
  continuityScore: number;
  perpendicularDensity: number;
}

function detectFeatures(edges: Uint8Array, region: PalmRegion, fullWidth: number, fullHeight: number): FeatureMetrics {
  const yEnd = Math.min(region.y + region.h, fullHeight);
  const xEnd = Math.min(region.x + region.w, fullWidth);

  let branchPoints = 0;
  let gapCount = 0;
  let prevRowHadEdge = false;
  const rowEdgeCounts: number[] = [];

  for (let y = region.y; y < yEnd; y++) {
    let rowEdges = 0;
    let rowHasEdge = false;
    for (let x = region.x; x < xEnd; x++) {
      if ((edges[y * fullWidth + x] ?? 0) > 0) {
        rowEdges++;
        rowHasEdge = true;
      }
    }
    rowEdgeCounts.push(rowEdges);
    if (prevRowHadEdge && !rowHasEdge) gapCount++;
    prevRowHadEdge = rowHasEdge;
  }

  for (let i = 1; i < rowEdgeCounts.length - 1; i++) {
    const prev = rowEdgeCounts[i - 1] ?? 0;
    const curr = rowEdgeCounts[i] ?? 0;
    const next = rowEdgeCounts[i + 1] ?? 0;
    if (curr > prev * 2 && curr > next * 2 && curr > 5) {
      branchPoints++;
    }
  }

  let perpendicularEdges = 0;
  let totalEdgePixels = 0;
  for (let y = region.y; y < yEnd; y++) {
    for (let x = region.x; x < xEnd; x++) {
      if ((edges[y * fullWidth + x] ?? 0) > 0) {
        totalEdgePixels++;
        const above = (edges[(y - 1) * fullWidth + x] ?? 0) > 0;
        const below = (edges[(y + 1) * fullWidth + x] ?? 0) > 0;
        if (!above && !below) perpendicularEdges++;
      }
    }
  }

  const totalRows = Math.max(1, yEnd - region.y);
  const continuityScore = 1 - Math.min(1, gapCount / totalRows);
  const islandRegions = Math.max(0, Math.round(branchPoints * 0.6));

  return {
    branchPoints: Math.min(8, branchPoints),
    islandRegions,
    gapCount,
    continuityScore,
    perpendicularDensity: totalEdgePixels > 0 ? perpendicularEdges / totalEdgePixels : 0,
  };
}

// ─── REGION DEFINITIONS ─────────────────────────────────────────────────────────

interface PalmRegion {
  name: string;
  x: number; y: number; w: number; h: number;
}

function getPalmRegions(w: number, h: number): Record<string, PalmRegion> {
  return {
    heart:     { name: "heart",     x: Math.floor(w * 0.1),  y: Math.floor(h * 0.18), w: Math.floor(w * 0.8),  h: Math.floor(h * 0.14) },
    head:      { name: "head",      x: Math.floor(w * 0.08), y: Math.floor(h * 0.32), w: Math.floor(w * 0.82), h: Math.floor(h * 0.13) },
    life:      { name: "life",      x: Math.floor(w * 0.15), y: Math.floor(h * 0.25), w: Math.floor(w * 0.45), h: Math.floor(h * 0.55) },
    fate:      { name: "fate",      x: Math.floor(w * 0.35), y: Math.floor(h * 0.2),  w: Math.floor(w * 0.3),  h: Math.floor(h * 0.65) },
    sun:       { name: "sun",       x: Math.floor(w * 0.55), y: Math.floor(h * 0.2),  w: Math.floor(w * 0.2),  h: Math.floor(h * 0.55) },
    marriage:  { name: "marriage",  x: Math.floor(w * 0.72), y: Math.floor(h * 0.15), w: Math.floor(w * 0.2),  h: Math.floor(h * 0.12) },
    mountVenus:     { name: "mountVenus",     x: Math.floor(w * 0.1),  y: Math.floor(h * 0.45), w: Math.floor(w * 0.35), h: Math.floor(h * 0.35) },
    mountJupiter:   { name: "mountJupiter",   x: Math.floor(w * 0.2),  y: Math.floor(h * 0.05), w: Math.floor(w * 0.2),  h: Math.floor(h * 0.15) },
    mountSaturn:    { name: "mountSaturn",    x: Math.floor(w * 0.4),  y: Math.floor(h * 0.05), w: Math.floor(w * 0.2),  h: Math.floor(h * 0.15) },
    mountApollo:    { name: "mountApollo",    x: Math.floor(w * 0.58), y: Math.floor(h * 0.05), w: Math.floor(w * 0.18), h: Math.floor(h * 0.15) },
    mountMercury:   { name: "mountMercury",   x: Math.floor(w * 0.74), y: Math.floor(h * 0.05), w: Math.floor(w * 0.18), h: Math.floor(h * 0.15) },
    mountMoon:      { name: "mountMoon",      x: Math.floor(w * 0.7),  y: Math.floor(h * 0.5),  w: Math.floor(w * 0.25), h: Math.floor(h * 0.35) },
    mountMarsPos:   { name: "mountMarsPos",   x: Math.floor(w * 0.15), y: Math.floor(h * 0.6),  w: Math.floor(w * 0.25), h: Math.floor(h * 0.25) },
    mountMarsNeg:   { name: "mountMarsNeg",   x: Math.floor(w * 0.7),  y: Math.floor(h * 0.3),  w: Math.floor(w * 0.2),  h: Math.floor(h * 0.2) },
  };
}

// ─── COMPREHENSIVE REGION ANALYSIS ──────────────────────────────────────────────

interface RegionMetrics {
  lineCount: number;
  avgIntensity: number;
  maxIntensity: number;
  lineDensity: number;
  continuity: number;
  directionality: DirectionalMetrics;
  curvature: CurvatureMetrics;
  features: FeatureMetrics;
}

function analyzeRegionFull(
  edges: Uint8Array,
  dir: Float32Array,
  region: PalmRegion,
  fullWidth: number,
  fullHeight: number,
): RegionMetrics {
  const yEnd = Math.min(region.y + region.h, fullHeight);
  const xEnd = Math.min(region.x + region.w, fullWidth);

  let count = 0;
  let sum = 0;
  let max = 0;

  for (let y = region.y; y < yEnd; y++) {
    for (let x = region.x; x < xEnd; x++) {
      const val = edges[y * fullWidth + x] ?? 0;
      if (val > 0) {
        count++;
        sum += val;
        if (val > max) max = val;
      }
    }
  }

  const totalPixels = Math.max(1, region.w * region.h);
  const lineDensity = count / totalPixels;
  const directionality = analyzeDirectionality(edges, dir, region, fullWidth, fullHeight);
  const curvature = measureCurvature(edges, region, fullWidth, fullHeight);
  const features = detectFeatures(edges, region, fullWidth, fullHeight);

  return {
    lineCount: count,
    avgIntensity: count > 0 ? sum / count : 0,
    maxIntensity: max,
    lineDensity,
    continuity: features.continuityScore,
    directionality,
    curvature,
    features,
  };
}

function regionToLineAnalysis(r: RegionMetrics): LineAnalysis {
  const density = r.lineDensity;
  const quality: LineQuality =
    density > 0.15 ? "strong" :
    density > 0.08 ? "moderate" :
    density > 0.03 ? "faint" : "absent";

  const length: "short" | "medium" | "long" =
    density > 0.12 ? "long" :
    density > 0.05 ? "medium" : "short";

  const curvature: LineCurvature =
    r.curvature.curvatureScore < 0.15 ? "straight" :
    r.curvature.curvatureScore < 0.35 ? "slight_curve" :
    r.curvature.curvatureScore < 0.6 ? "curved" : "wavy";

  const depthScore = r.avgIntensity / 255;
  const continuityBonus = r.continuity * 25;
  const densityScore = density * 350;
  const intensityBonus = depthScore * 20;
  const featurePenalty = Math.max(0, (r.features.branchPoints + r.features.gapCount) * 2);
  const presenceBonus = quality === "absent" ? 0 : 10;

  const score = Math.min(100, Math.max(0, Math.round(
    densityScore + continuityBonus + intensityBonus - featurePenalty + presenceBonus
  )));

  return {
    present: quality !== "absent",
    quality,
    length,
    depth: Math.round(depthScore * 100) / 100,
    curvature,
    branches: r.features.branchPoints,
    breaks: r.features.gapCount > 3 ? 2 : r.features.gapCount > 1 ? 1 : 0,
    chains: r.continuity < 0.4 && density > 0.04,
    forks: r.features.perpendicularDensity > 0.3 && r.continuity < 0.6 ? 1 : 0,
    islands: r.features.islandRegions > 0 && r.continuity < 0.5,
    startRegion: r.directionality.dominantDirection,
    endRegion: r.curvature.segments > 0 ? `${r.curvature.segments} segments` : undefined,
    score,
  };
}

// ─── HAND SHAPE CLASSIFICATION ──────────────────────────────────────────────────

function classifyHandShape(edges: Uint8Array, gray: Uint8Array, w: number, h: number): HandShapeAnalysis {
  let minX = w, maxX = 0, minY = h, maxY = 0;
  let edgeCount = 0;
  let sumX = 0, sumY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((edges[y * w + x] ?? 0) > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        edgeCount++;
        sumX += x;
        sumY += y;
      }
    }
  }

  const handWidth = Math.max(1, maxX - minX);
  const handHeight = Math.max(1, maxY - minY);
  const palmWidth = handWidth * 0.75;
  const palmLength = handHeight * 0.45;
  const fingerLength = handHeight * 0.55;
  const fingerRatio = fingerLength / Math.max(1, palmLength);
  const palmAspect = palmWidth / Math.max(1, palmLength);

  const fireScore = (palmLength / Math.max(1, palmWidth)) * (1 / Math.max(0.5, fingerRatio));
  const earthScore = (palmWidth / Math.max(1, palmLength)) * (1 / Math.max(0.5, fingerRatio));
  const airScore = (1 / Math.max(0.01, Math.abs(palmAspect - 1))) * fingerRatio;
  const waterScore = (palmLength / Math.max(1, palmWidth)) * fingerRatio;

  const scores: Array<[HandElement, number]> = [
    ["fire", fireScore],
    ["earth", earthScore],
    ["air", airScore],
    ["water", waterScore],
  ];
  scores.sort((a, b) => b[1] - a[1]);

  const total = scores.reduce((s, [, v]) => s + v, 0);
  const confidence = total > 0 ? scores[0]![1] / total : 0.25;
  const element = scores[0]![0];

  const fingerTipY = minY + Math.floor(handHeight * 0.15);
  const fingerTipRegion = gray.slice(
    fingerTipY * w,
    Math.min((fingerTipY + Math.floor(handHeight * 0.1)) * w, gray.length),
  );
  let tipVariance = 0;
  if (fingerTipRegion.length > 0) {
    const tipMean = fingerTipRegion.reduce((s, v) => s + v, 0) / fingerTipRegion.length;
    tipVariance = fingerTipRegion.reduce((s, v) => s + (v - tipMean) ** 2, 0) / fingerTipRegion.length;
  }

  const dominantFingerShape: FingerShape =
    tipVariance > 3000 ? "spatulate" :
    tipVariance > 2000 ? "pointed" :
    tipVariance > 1200 ? "conic" : "square";

  return {
    element,
    palmWidth,
    palmLength,
    fingerLength,
    fingerRatio: Math.round(fingerRatio * 100) / 100,
    dominantFingerShape,
    confidence: Math.min(0.95, Math.round(confidence * 100) / 100),
  };
}

// ─── MOUNT ANALYSIS (LAPLACIAN-BASED) ───────────────────────────────────────────

function analyzeMounts(gray: Uint8Array, edges: Uint8Array, w: number, h: number): MountAnalysis[] {
  const regions = getPalmRegions(w, h);
  const laplacian = laplacianSharpen(gray, w, h);
  const mounts: MountName[] = ["venus", "jupiter", "saturn", "apollo", "mercury", "moon", "mars_positive", "mars_negative"];
  const mountRegionKeys: Record<MountName, string> = {
    venus: "mountVenus", jupiter: "mountJupiter", saturn: "mountSaturn",
    apollo: "mountApollo", mercury: "mountMercury", moon: "mountMoon",
    mars_positive: "mountMarsPos", mars_negative: "mountMarsNeg",
  };

  return mounts.map((name) => {
    const key = mountRegionKeys[name];
    const region = regions[key];
    if (!region) {
      return { name: MOUNT_KNOWLEDGE[name]?.name ?? name, planet: MOUNT_KNOWLEDGE[name]?.planet ?? "", development: "moderate" as MountDevelopment, score: 50 };
    }

    const yEnd = Math.min(region.y + region.h, h);
    const xEnd = Math.min(region.x + region.w, w);

    let graySum = 0, grayCount = 0;
    let grayMin = 255, grayMax = 0;
    let lapSum = 0, lapCount = 0;
    let edgeCount = 0;

    for (let y = region.y; y < yEnd; y++) {
      for (let x = region.x; x < xEnd; x++) {
        const idx = y * w + x;
        const gv = gray[idx] ?? 128;
        graySum += gv;
        grayCount++;
        if (gv < grayMin) grayMin = gv;
        if (gv > grayMax) grayMax = gv;
        lapSum += laplacian[idx] ?? 128;
        lapCount++;
        if ((edges[idx] ?? 0) > 0) edgeCount++;
      }
    }

    const grayAvg = grayCount > 0 ? graySum / grayCount : 128;
    const grayRange = grayMax - grayMin;
    const lapAvg = lapCount > 0 ? lapSum / lapCount : 128;
    const lapVariance = lapCount > 0
      ? Math.max(0, lapAvg - 128)
      : 0;

    const textureScore = grayRange / 255;
    const edgeDensity = edgeCount / Math.max(1, region.w * region.h);
    const developmentSignal = textureScore * 0.4 + Math.min(1, lapVariance / 60) * 0.35 + edgeDensity * 0.25;

    let development: MountDevelopment;
    let score: number;
    if (developmentSignal > 0.65) {
      development = "over_developed";
      score = 85 + Math.round((developmentSignal - 0.65) * 43);
    } else if (developmentSignal > 0.4) {
      development = "well_developed";
      score = 65 + Math.round((developmentSignal - 0.4) * 80);
    } else if (developmentSignal > 0.2) {
      development = "moderate";
      score = 40 + Math.round((developmentSignal - 0.2) * 125);
    } else {
      development = "flat";
      score = Math.round(developmentSignal * 200);
    }

    return {
      name: MOUNT_KNOWLEDGE[name]?.name ?? name,
      planet: MOUNT_KNOWLEDGE[name]?.planet ?? "",
      development,
      score: Math.min(100, Math.max(0, score)),
    };
  });
}

// ─── CROSS-LINE ANALYSIS ────────────────────────────────────────────────────────

interface CrossLineInsight {
  pair: string;
  insight: string;
  score: number;
}

function computeCrossLineInsights(lines: PalmAnalysisResult["lines"]): CrossLineInsight[] {
  const insights: CrossLineInsight[] = [];

  const heart = lines.heart;
  const head = lines.head;
  if (heart && head) {
    if (heart.quality === "strong" && head.curvature === "curved") {
      insights.push({ pair: "heart+head", insight: "Heart-Head harmony: You balance emotion and intellect beautifully — decisions integrate both feeling and logic.", score: 85 });
    } else if (heart.curvature === "straight" && head.curvature === "straight") {
      insights.push({ pair: "heart+head", insight: "Double straight pattern: Highly rational approach to both thinking and feeling — you lead with logic in all matters.", score: 72 });
    } else if (heart.score > 60 && head.score < 40) {
      insights.push({ pair: "heart+head", insight: "Heart-dominant pattern: Your emotional intelligence significantly outpaces analytical thinking — you feel before you think.", score: 65 });
    } else {
      insights.push({ pair: "heart+head", insight: "Balanced heart-head dynamic: Neither dominates — you adapt your approach based on the situation.", score: 70 });
    }
  }

  const life = lines.life;
  const fate = lines.fate;
  if (life && fate) {
    if (life.score > 60 && fate.score > 60) {
      insights.push({ pair: "life+fate", insight: "Strong life-fate axis: Exceptional vitality aligned with clear purpose — you have the energy AND the direction to achieve great things.", score: 88 });
    } else if (life.score > 60 && fate.score < 40) {
      insights.push({ pair: "life+fate", insight: "Vital but unchanneled: Abundant energy without a clear destination — finding your purpose will unlock your full potential.", score: 60 });
    } else if (life.score < 40 && fate.score > 60) {
      insights.push({ pair: "life+fate", insight: "Purpose-driven but needs vitality: Clear destiny calls, but sustaining the energy to reach it requires conscious self-care.", score: 58 });
    }
  }

  const sun = lines.sun;
  if (sun && fate) {
    if (sun.score > 50 && fate.score > 50) {
      insights.push({ pair: "sun+fate", insight: "Sun-Fate alignment: Your career path naturally leads to recognition — your purpose and public success are intertwined.", score: 82 });
    }
  }

  return insights;
}

// ─── MAIN ANALYSIS FUNCTION ─────────────────────────────────────────────────────

export async function analyzePalmImage(
  imageSrc: string,
  handSide: HandSide,
): Promise<PalmAnalysisResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const maxDim = 450;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }

        ctx.drawImage(img, 0, 0, w, h);

        const rawGray = toGrayscale(ctx, w, h);
        const equalized = histogramEqualize(rawGray);
        const blurred = gaussianBlur(equalized, w, h);

        const { magnitude, direction } = sobelEdgeDetect(blurred, w, h);
        const suppressed = nonMaxSuppression(magnitude, direction, w, h);
        const edges = hysteresisThreshold(suppressed, w, h, 25, 70);

        const smallScale = gaussianBlur(equalized, w, h);
        const { magnitude: mag2 } = sobelEdgeDetect(smallScale, w, h);
        const edges2 = hysteresisThreshold(mag2, w, h, 40, 100);

        const combined = new Uint8Array(w * h);
        for (let i = 0; i < combined.length; i++) {
          combined[i] = ((edges[i] ?? 0) > 0 || (edges2[i] ?? 0) > 0) ? 255 : 0;
        }

        const lineNames = ["heart", "head", "life", "fate", "sun", "marriage"] as const;
        const regions = getPalmRegions(w, h);
        const lineResults: Record<string, LineAnalysis> = {};

        for (const name of lineNames) {
          const region = regions[name];
          if (!region) continue;
          const metrics = analyzeRegionFull(combined, direction, region, w, h);
          lineResults[name] = regionToLineAnalysis(metrics);
        }

        const defaultLine: LineAnalysis = { present: false, quality: "absent", length: "short", depth: 0, curvature: "straight", branches: 0, breaks: 0, chains: false, forks: 0, islands: false, score: 0 };

        const handShape = classifyHandShape(combined, equalized, w, h);
        const mounts = analyzeMounts(equalized, combined, w, h);

        const lines = {
          heart: lineResults.heart ?? defaultLine,
          head: lineResults.head ?? defaultLine,
          life: lineResults.life ?? defaultLine,
          fate: lineResults.fate ?? defaultLine,
          sun: lineResults.sun ?? defaultLine,
          marriage: lineResults.marriage ?? defaultLine,
        };

        const lineScores = Object.values(lines).map((l) => l.score);
        const mountScores = mounts.map((m) => m.score);
        const lineAvg = lineScores.reduce((a, b) => a + b, 0) / Math.max(1, lineScores.length);
        const mountAvg = mountScores.reduce((a, b) => a + b, 0) / Math.max(1, mountScores.length);
        const overallScore = Math.round(lineAvg * 0.55 + mountAvg * 0.3 + handShape.confidence * 100 * 0.15);

        const dominantTraits: string[] = [];
        if (lines.heart.score > 60) dominantTraits.push("Emotional depth");
        if (lines.head.score > 60) dominantTraits.push("Sharp intellect");
        if (lines.life.score > 60) dominantTraits.push("Strong vitality");
        if (lines.fate.score > 60) dominantTraits.push("Clear purpose");
        if (lines.sun.score > 50) dominantTraits.push("Creative brilliance");
        dominantTraits.push(`${handShape.element.charAt(0).toUpperCase() + handShape.element.slice(1)} energy`);

        const crossInsights = computeCrossLineInsights(lines);
        const crossBonus = crossInsights.length > 0
          ? crossInsights.reduce((s, c) => s + c.score, 0) / crossInsights.length * 0.05
          : 0;
        const finalScore = Math.min(100, Math.round(overallScore + crossBonus));

        resolve({
          handSide,
          handShape,
          lines,
          mounts,
          overallScore: finalScore,
          dominantTraits,
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });
}

export function getEdgeOverlay(
  imageSrc: string,
  width: number,
  height: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, width / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const raw = toGrayscale(ctx, w, h);
      const eq = histogramEqualize(raw);
      const blurred = gaussianBlur(eq, w, h);
      const { magnitude, direction } = sobelEdgeDetect(blurred, w, h);
      const suppressed = nonMaxSuppression(magnitude, direction, w, h);
      const edges = hysteresisThreshold(suppressed, w, h, 35, 90);
      const imgData = ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < edges.length; i++) {
        if ((edges[i] ?? 0) > 0) {
          imgData.data[i * 4] = 168;
          imgData.data[i * 4 + 1] = 85;
          imgData.data[i * 4 + 2] = 247;
          imgData.data[i * 4 + 3] = 200;
        } else {
          imgData.data[i * 4 + 3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });
}
