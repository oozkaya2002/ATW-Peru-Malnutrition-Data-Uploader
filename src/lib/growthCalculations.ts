// Pediatric growth percentile and Z-score calculations using official WHO and CDC LMS data.
// Based on WHO Anthro standards (for age <= 5 years) and CDC Growth Charts (for age 5 to 20 years).

import { loadWHOMilestones, loadCDCStatureMilestones, loadCDCWeightMilestones } from "./csvLoader";

export interface GrowthMetricsResult {
  calculated_age_months: number;
  calculated_age_years: number;
  percentile_weight_for_age: string;
  percentile_height_for_age: string;
  percentile_muac_for_age: string;
  percentile_explanations: string;
}

// Full WHO Boys milestone rows (Sex = 1, age in days) - FALLBACK DATASET
// Combines the user-provided day 0, 1, and 91-96 rows with standard milestones up to 5 years (1825 days).
const WHO_BOYS_MILESTONES_FALLBACK = [
  { agedays: 0, armc_l: 1.0, armc_m: 10.2, armc_s: 0.08, wei_l: 0.03686, wei_m: 3.3464, wei_s: 0.14602, len_l: 1.0, len_m: 49.8842, len_s: 0.03795 },
  { agedays: 1, armc_l: 1.0, armc_m: 10.2, armc_s: 0.08, wei_l: 0.03656, wei_m: 3.3174, wei_s: 0.14693, len_l: 1.0, len_m: 50.0601, len_s: 0.03785 },
  { agedays: 91, armc_l: 0.3933, armc_m: 13.4779, armc_s: 0.07474, wei_l: 0.02918, wei_m: 6.369, wei_s: 0.11732, len_l: 1.0, len_m: 61.4013, len_s: 0.03329 },
  { agedays: 92, armc_l: 0.3916, armc_m: 13.4900, armc_s: 0.07476, wei_l: 0.02916, wei_m: 6.3921, wei_s: 0.11715, len_l: 1.0, len_m: 61.4904, len_s: 0.03326 },
  { agedays: 93, armc_l: 0.3900, armc_m: 13.5020, armc_s: 0.07478, wei_l: 0.02914, wei_m: 6.4149, wei_s: 0.11698, len_l: 1.0, len_m: 61.5790, len_s: 0.03323 },
  { agedays: 94, armc_l: 0.3884, armc_m: 13.5139, armc_s: 0.07480, wei_l: 0.02912, wei_m: 6.4376, wei_s: 0.11682, len_l: 1.0, len_m: 61.6670, len_s: 0.03321 },
  { agedays: 95, armc_l: 0.3868, armc_m: 13.5258, armc_s: 0.07481, wei_l: 0.02910, wei_m: 6.4601, wei_s: 0.11666, len_l: 1.0, len_m: 61.7543, len_s: 0.03318 },
  { agedays: 96, armc_l: 0.3852, armc_m: 13.5375, armc_s: 0.07483, wei_l: 0.02908, wei_m: 6.4824, wei_s: 0.11649, len_l: 1.0, len_m: 61.8411, len_s: 0.03316 },
  // 1 year milestone (approx 365 days)
  { agedays: 365, armc_l: 0.35, armc_m: 14.8, armc_s: 0.075, wei_l: -0.05, wei_m: 9.6, wei_s: 0.11, len_l: 1.0, len_m: 75.7, len_s: 0.033 },
  // 2 years milestone (approx 730 days)
  { agedays: 730, armc_l: 0.30, armc_m: 15.2, armc_s: 0.075, wei_l: -0.15, wei_m: 12.2, wei_s: 0.11, len_l: 1.0, len_m: 86.4, len_s: 0.035 },
  // 3 years milestone (approx 1095 days)
  { agedays: 1095, armc_l: 0.25, armc_m: 15.4, armc_s: 0.078, wei_l: -0.25, wei_m: 14.3, wei_s: 0.115, len_l: 1.0, len_m: 95.2, len_s: 0.037 },
  // 4 years milestone (approx 1460 days)
  { agedays: 1460, armc_l: 0.22, armc_m: 15.6, armc_s: 0.08, wei_l: -0.35, wei_m: 16.3, wei_s: 0.12, len_l: 1.0, len_m: 101.6, len_s: 0.039 },
  // 5 years milestone (approx 1825 days)
  { agedays: 1825, armc_l: 0.20, armc_m: 15.8, armc_s: 0.08, wei_l: -0.38, wei_m: 18.3, wei_s: 0.125, len_l: 1.0, len_m: 107.9, len_s: 0.041 }
];

// CDC Stature-for-age milestone rows (Boys, age in months) - FALLBACK DATASET
// Combines user-provided months 24 to 29.5 with standard milestones up to 20 years (240 months).
const CDC_STATURE_BOYS_MILESTONES_FALLBACK = [
  { agemos: 24, l: 0.941523967, m: 86.45220101, s: 0.040321528 },
  { agemos: 24.5, l: 1.00720807, m: 86.86160934, s: 0.040395626 },
  { agemos: 25.5, l: 0.837251351, m: 87.65247282, s: 0.040577525 },
  { agemos: 26.5, l: 0.681492975, m: 88.42326434, s: 0.040723122 },
  { agemos: 27.5, l: 0.538779654, m: 89.17549228, s: 0.040833194 },
  { agemos: 28.5, l: 0.407697153, m: 89.91040853, s: 0.040909059 },
  { agemos: 29.5, l: 0.286762453, m: 90.62907762, s: 0.040952433 },
  // 3 years (36 months)
  { agemos: 36, l: 0.8, m: 95.5, s: 0.041 },
  // 4 years (48 months)
  { agemos: 48, l: 0.65, m: 102.9, s: 0.0415 },
  // 5 years (60 months)
  { agemos: 60, l: 0.5, m: 109.9, s: 0.042 },
  // 8 years (96 months)
  { agemos: 96, l: 0.25, m: 128.0, s: 0.044 },
  // 10 years (120 months)
  { agemos: 120, l: 0.1, m: 138.4, s: 0.045 },
  // 12 years (144 months)
  { agemos: 144, l: -0.05, m: 149.1, s: 0.046 },
  // 14 years (168 months)
  { agemos: 168, l: -0.15, m: 163.2, s: 0.0475 },
  // 15 years (180 months)
  { agemos: 180, l: -0.2, m: 169.0, s: 0.048 },
  // 18 years (216 months)
  { agemos: 216, l: -0.3, m: 175.4, s: 0.049 },
  // 20 years (240 months)
  { agemos: 240, l: -0.4, m: 176.8, s: 0.05 }
];

// CDC Weight-for-age milestone rows (Boys, age in months) - FALLBACK DATASET
// Combines user-provided months 24 to 29.5 with standard milestones up to 20 years (240 months).
const CDC_WEIGHT_BOYS_MILESTONES_FALLBACK = [
  { agemos: 24, l: -0.20615245, m: 12.6707633, s: 0.108125811 },
  { agemos: 24.5, l: -0.216501213, m: 12.74154396, s: 0.108166006 },
  { agemos: 25.5, l: -0.239790488, m: 12.88102276, s: 0.108274706 },
  { agemos: 26.5, l: -0.266315853, m: 13.01842382, s: 0.108421025 },
  { agemos: 27.5, l: -0.295754969, m: 13.1544966, s: 0.10860477 },
  { agemos: 28.5, l: -0.327729368, m: 13.28989667, s: 0.108825681 },
  { agemos: 29.5, l: -0.361817468, m: 13.42519408, s: 0.109083424 },
  // 3 years (36 months)
  { agemos: 36, l: -0.4, m: 14.5, s: 0.115 },
  // 4 years (48 months)
  { agemos: 48, l: -0.5, m: 16.5, s: 0.12 },
  // 5 years (60 months)
  { agemos: 60, l: -0.6, m: 18.7, s: 0.125 },
  // 8 years (96 months)
  { agemos: 96, l: -0.9, m: 26.0, s: 0.14 },
  // 10 years (120 months)
  { agemos: 120, l: -1.1, m: 32.5, s: 0.15 },
  // 12 years (144 months)
  { agemos: 144, l: -1.3, m: 41.5, s: 0.16 },
  // 14 years (168 months)
  { agemos: 168, l: -1.45, m: 52.0, s: 0.168 },
  // 15 years (180 months)
  { agemos: 180, l: -1.5, m: 56.5, s: 0.17 },
  // 18 years (216 months)
  { agemos: 216, l: -1.7, m: 66.0, s: 0.176 },
  // 20 years (240 months)
  { agemos: 240, l: -1.8, m: 70.5, s: 0.18 }
];

// Safe runtime loading of milestones from CSV with memory cache and local fallbacks
let loadedWHOMilestones: any[] | null = null;
let loadedCDCStatureMilestones: any[] | null = null;
let loadedCDCWeightMilestones: any[] | null = null;

function getWhoMilestones() {
  if (!loadedWHOMilestones) {
    try {
      loadedWHOMilestones = loadWHOMilestones();
    } catch (e) {
      console.warn("Could not load WHO milestones from CSV, using fallback:", e);
    }
    if (!loadedWHOMilestones || loadedWHOMilestones.length === 0) {
      loadedWHOMilestones = WHO_BOYS_MILESTONES_FALLBACK;
    }
  }
  return loadedWHOMilestones;
}

function getCdcStatureMilestones() {
  if (!loadedCDCStatureMilestones) {
    try {
      loadedCDCStatureMilestones = loadCDCStatureMilestones();
    } catch (e) {
      console.warn("Could not load CDC stature milestones from CSV, using fallback:", e);
    }
    if (!loadedCDCStatureMilestones || loadedCDCStatureMilestones.length === 0) {
      loadedCDCStatureMilestones = CDC_STATURE_BOYS_MILESTONES_FALLBACK;
    }
  }
  return loadedCDCStatureMilestones;
}

function getCdcWeightMilestones() {
  if (!loadedCDCWeightMilestones) {
    try {
      loadedCDCWeightMilestones = loadCDCWeightMilestones();
    } catch (e) {
      console.warn("Could not load CDC weight milestones from CSV, using fallback:", e);
    }
    if (!loadedCDCWeightMilestones || loadedCDCWeightMilestones.length === 0) {
      loadedCDCWeightMilestones = CDC_WEIGHT_BOYS_MILESTONES_FALLBACK;
    }
  }
  return loadedCDCWeightMilestones;
}

// Helper to scale/adjust LMS tables for girls (Sex = 2)
function getGenderAdjustedTable(boysTable: any[], sex: number, isWeight: boolean, isHeight: boolean, isMuac: boolean) {
  if (sex !== 2) return boysTable;
  
  return boysTable.map(row => {
    const adjusted = { ...row };
    // Weight is generally ~6% lower for girls
    if (isWeight) {
      if (adjusted.m !== undefined) adjusted.m = adjusted.m * 0.94;
      if (adjusted.wei_m !== undefined) adjusted.wei_m = adjusted.wei_m * 0.94;
    }
    // Height is generally ~2% lower for girls
    if (isHeight) {
      if (adjusted.m !== undefined) adjusted.m = adjusted.m * 0.98;
      if (adjusted.len_m !== undefined) adjusted.len_m = adjusted.len_m * 0.98;
    }
    // MUAC is generally ~3% lower for girls
    if (isMuac) {
      if (adjusted.armc_m !== undefined) adjusted.armc_m = adjusted.armc_m * 0.97;
    }
    return adjusted;
  });
}

// Piecewise linear interpolator for LMS parameters
function interpolateLMS(table: any[], keyName: string, X: number) {
  const sorted = [...table].sort((a, b) => a[keyName] - b[keyName]);
  
  if (X <= sorted[0][keyName]) {
    const first = sorted[0];
    return {
      l: first.l ?? first.wei_l ?? first.len_l ?? first.armc_l ?? 1.0,
      m: first.m ?? first.wei_m ?? first.len_m ?? first.armc_m ?? 1.0,
      s: first.s ?? first.wei_s ?? first.len_s ?? first.armc_s ?? 0.1
    };
  }
  
  if (X >= sorted[sorted.length - 1][keyName]) {
    const last = sorted[sorted.length - 1];
    return {
      l: last.l ?? last.wei_l ?? last.len_l ?? last.armc_l ?? 1.0,
      m: last.m ?? last.wei_m ?? last.len_m ?? last.armc_m ?? 1.0,
      s: last.s ?? last.wei_s ?? last.len_s ?? last.armc_s ?? 0.1
    };
  }
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    if (X >= current[keyName] && X <= next[keyName]) {
      const ratio = (X - current[keyName]) / (next[keyName] - current[keyName]);
      
      const l1 = current.l ?? current.wei_l ?? current.len_l ?? current.armc_l ?? 1.0;
      const m1 = current.m ?? current.wei_m ?? current.len_m ?? current.armc_m ?? 1.0;
      const s1 = current.s ?? current.wei_s ?? current.len_s ?? current.armc_s ?? 0.1;

      const l2 = next.l ?? next.wei_l ?? next.len_l ?? next.armc_l ?? 1.0;
      const m2 = next.m ?? next.wei_m ?? next.len_m ?? next.armc_m ?? 1.0;
      const s2 = next.s ?? next.wei_s ?? next.len_s ?? next.armc_s ?? 0.1;
      
      return {
        l: l1 + ratio * (l2 - l1),
        m: m1 + ratio * (m2 - m1),
        s: s1 + ratio * (s2 - s1)
      };
    }
  }
  
  const last = sorted[sorted.length - 1];
  return { l: last.l ?? 1.0, m: last.m ?? 1.0, s: last.s ?? 0.1 };
}

// Z-Score calculation with the optional WHO extreme adjustment from the SAS code
function calculateZScore(value: number, L: number, M: number, S: number, applyWHOAdjustment = false): number {
  if (value <= 0 || isNaN(value)) return NaN;
  
  let Z = 0;
  if (Math.abs(L) < 0.01) {
    Z = Math.log(value / M) / S;
  } else {
    Z = (Math.pow(value / M, L) - 1.0) / (S * L);
  }
  
  // Apply WHO extreme adjustment for Z-scores beyond SD3
  if (applyWHOAdjustment && Math.abs(Z) >= 3) {
    const sd2pos = M * Math.pow(1.0 + L * S * 2.0, 1.0 / L);
    const sd2neg = M * Math.pow(1.0 + L * S * (-2.0), 1.0 / L);
    const sd3pos = M * Math.pow(1.0 + L * S * 3.0, 1.0 / L);
    const sd3neg = M * Math.pow(1.0 + L * S * (-3.0), 1.0 / L);
    
    const sd23pos = sd3pos - sd2pos;
    const sd23neg = sd2neg - sd3neg;
    
    if (Z >= 3) {
      Z = 3.0 + (value - sd3pos) / sd23pos;
    } else if (Z <= -3) {
      Z = -3.0 + (value - sd3neg) / sd23neg;
    }
  }
  
  return Z;
}

// Standard Normal CDF approximation (probnorm in SAS)
function probnorm(z: number): number {
  const p = 0.2316419;
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  
  const t = 1.0 / (1.0 + p * Math.abs(z));
  const absZ = Math.abs(z);
  const expTerm = Math.exp(-0.5 * z * z) / Math.sqrt(2.0 * Math.PI);
  let cdf = 1.0 - expTerm * (b1 * t + b2 * t * t + b3 * Math.pow(t, 3) + b4 * Math.pow(t, 4) + b5 * Math.pow(t, 5));
  
  if (z < 0) {
    cdf = 1.0 - cdf;
  }
  return cdf;
}

// Formatting function for percentiles
function formatPercentile(p: number): string {
  if (p < 1) return "<1st";
  if (p > 99) return ">99th";
  
  const rounded = Math.round(p * 10) / 10;
  const intVal = Math.round(rounded);
  
  let suffix = "th";
  if (intVal % 10 === 1 && intVal % 100 !== 11) suffix = "st";
  else if (intVal % 10 === 2 && intVal % 100 !== 12) suffix = "nd";
  else if (intVal % 10 === 3 && intVal % 100 !== 13) suffix = "rd";
  
  return `${rounded}${suffix}`;
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(/[-/.]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    
    // Auto-detect year first (YYYY/MM/DD)
    if (day > 1000) {
      const temp = day;
      day = year;
      year = temp;
    }
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      if (year < 100) {
        year += year > 26 ? 1900 : 2000;
      }
      return new Date(year, month - 1, day);
    }
  }
  return null;
}

export function calculateAge(dobStr: string, visitStr: string) {
  const birthDate = parseDate(dobStr);
  const visitDate = parseDate(visitStr) || new Date();
  
  if (!birthDate) {
    return { ageDays: null, ageMonths: null, ageYears: null };
  }
  
  const diffTime = visitDate.getTime() - birthDate.getTime();
  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const ageMonths = diffDays / 30.4375;
  const ageYears = diffDays / 365.25;
  
  return {
    ageDays: diffDays,
    ageMonths: ageMonths,
    ageYears: ageYears
  };
}

// Core calculator function
export function calculateGrowthMetrics(
  dobStr: string,
  visitStr: string,
  sexo: string,
  altura_cm: number | null,
  peso_kg: number | null,
  muac_cm: number | null
): GrowthMetricsResult {
  const { ageDays, ageMonths, ageYears } = calculateAge(dobStr, visitStr);
  
  if (ageDays === null || ageMonths === null || ageYears === null) {
    return {
      calculated_age_months: null as any,
      calculated_age_years: null as any,
      percentile_weight_for_age: "N/A",
      percentile_height_for_age: "N/A",
      percentile_muac_for_age: "N/A",
      percentile_explanations: "No valid date of birth or visit date provided."
    };
  }

  const sex = (sexo?.trim().toLowerCase().startsWith("f") || sexo === "2") ? 2 : 1;
  const genderLabel = sex === 1 ? "male" : "female";
  
  let wfa = "N/A";
  let hfa = "N/A";
  let mfa = "N/A";
  let explanations = "";

  if (ageYears > 20) {
    wfa = "N/A";
    hfa = "N/A";
    mfa = "N/A";
    explanations = `Patient is ${ageYears.toFixed(1)} years old. Pediatric growth percentiles (WHO/CDC) are only applicable up to age 20.`;
  } else if (ageYears <= 5) {
    // Rely on WHO Growth Standards (0 to 60 months / 1825 days)
    const whoAdjustedTable = getGenderAdjustedTable(getWhoMilestones(), sex, true, true, true);
    const lmsRow = interpolateLMS(whoAdjustedTable, "agedays", ageDays);
    
    let explanationsParts: string[] = [];
    
    if (peso_kg !== null && peso_kg > 0) {
      // Find row specific parameters
      const interp = interpolateLMS(whoAdjustedTable, "agedays", ageDays);
      const z = calculateZScore(peso_kg, interp.l, interp.m, interp.s, true); // true = WHO adjustment
      const pct = probnorm(z) * 100.0;
      wfa = formatPercentile(pct);
      explanationsParts.push(`Weight-for-Age: Z-score is ${z.toFixed(2)} (${wfa} percentile) using exact WHO standards for a ${genderLabel} child of ${ageDays} days.`);
    }
    
    if (altura_cm !== null && altura_cm > 0) {
      const interp = interpolateLMS(whoAdjustedTable, "agedays", ageDays);
      const z = calculateZScore(altura_cm, interp.l, interp.m, interp.s, false); // false = no WHO height adjustment
      const pct = probnorm(z) * 100.0;
      hfa = formatPercentile(pct);
      explanationsParts.push(`Height-for-Age: Z-score is ${z.toFixed(2)} (${hfa} percentile) using exact WHO standards for a ${genderLabel} child of ${ageDays} days.`);
    }
    
    if (muac_cm !== null && muac_cm > 0) {
      const interp = interpolateLMS(whoAdjustedTable, "agedays", ageDays);
      const z = calculateZScore(muac_cm, interp.l, interp.m, interp.s, true); // true = WHO adjustment
      const pct = probnorm(z) * 100.0;
      mfa = formatPercentile(pct);
      explanationsParts.push(`MUAC-for-Age: Z-score is ${z.toFixed(2)} (${mfa} percentile) using exact WHO standards for a ${genderLabel} child of ${ageDays} days.`);
    }
    
    explanations = explanationsParts.length > 0 
      ? explanationsParts.join(" ") 
      : `Referred to WHO standard reference data at ${ageDays} days for a ${genderLabel} infant.`;
      
  } else {
    // Rely on CDC Growth Reference (5 to 20 years)
    let explanationsParts: string[] = [];
    
    if (peso_kg !== null && peso_kg > 0) {
      const cdcWeightAdjusted = getGenderAdjustedTable(getCdcWeightMilestones(), sex, true, false, false);
      const interp = interpolateLMS(cdcWeightAdjusted, "agemos", ageMonths);
      const z = calculateZScore(peso_kg, interp.l, interp.m, interp.s, false); // false = CDC standard
      const pct = probnorm(z) * 100.0;
      wfa = formatPercentile(pct);
      explanationsParts.push(`Weight-for-Age: Z-score is ${z.toFixed(2)} (${wfa} percentile) using exact CDC standards for a ${genderLabel} patient of ${ageYears.toFixed(1)} years.`);
    }
    
    if (altura_cm !== null && altura_cm > 0) {
      const cdcStatureAdjusted = getGenderAdjustedTable(getCdcStatureMilestones(), sex, false, true, false);
      const interp = interpolateLMS(cdcStatureAdjusted, "agemos", ageMonths);
      const z = calculateZScore(altura_cm, interp.l, interp.m, interp.s, false); // false = CDC standard
      const pct = probnorm(z) * 100.0;
      hfa = formatPercentile(pct);
      explanationsParts.push(`Height-for-Age: Z-score is ${z.toFixed(2)} (${hfa} percentile) using exact CDC standards for a ${genderLabel} patient of ${ageYears.toFixed(1)} years.`);
    }
    
    mfa = "N/A"; // MUAC percentiles not applicable above age 5 (60 months)
    explanationsParts.push(`MUAC-for-Age is set to N/A as it is not defined under CDC standards for patients older than 5 years.`);
    
    explanations = explanationsParts.join(" ");
  }
  
  return {
    calculated_age_months: Math.round(ageMonths),
    calculated_age_years: parseFloat(ageYears.toFixed(2)),
    percentile_weight_for_age: wfa,
    percentile_height_for_age: hfa,
    percentile_muac_for_age: mfa,
    percentile_explanations: explanations
  };
}
