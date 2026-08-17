export type Meta = {
  categories: string[];
  unido: string[];
  states: string[];
  municipalities: string[];
  sources: string[];
  econ: Record<string, EconSet>;
};

export type EconRow = {
  cat: string;
  floor: number;
  usd: number;
  prod: number;
  emp: number;
  empW: number;
  total: number;
};

export type EconSet = { rows: EconRow[]; broad: { cat: string; total: number }[] };

export type Facilities = {
  n: string[];
  la: number[];
  lo: number[];
  c: number[];
  u: number[];
  st: number[];
  mu: number[];
  s: number[];
  a: number[];
  fw: number[];
  /** Production-based water demand per site (m³/yr). */
  pw: number[];
  /** Employee-based water demand per site (m³/yr). */
  ew: number[];
  w: number[];
};

export const THRESHOLDS = [250, 500, 1000] as const;
export type Threshold = (typeof THRESHOLDS)[number];

export async function loadMeta(): Promise<Meta> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/meta.json`);
  if (!res.ok) throw new Error("Failed to load metadata");
  return res.json();
}

export async function loadFacilities(threshold: Threshold): Promise<Facilities> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/facilities-${threshold}.json`);
  if (!res.ok) throw new Error("Failed to load facility data");
  return res.json();
}

/**
 * Facility-level demand (`pw`, `ew`, `fw`, `w`) is pre-computed in
 * `public/data/facilities-*.json` by disaggregating the authoritative
 * category totals across sites in proportion to footprint area — the exact
 * method used by the State / Municipality / Industry_Type reference sheets.
 * Any subset therefore sums to the published state, municipality and
 * industry-category figures, so no runtime reconciliation is needed.
 */

export type Filters = {
  sources: number[];
  states: number[];
  municipalities: number[];
  categories: number[];
  minDemand: number;
  maxDemand: number;
  search: string;
};

/** Indices of facilities passing the current filters. */
export function filterIndices(f: Facilities, filters: Filters): Uint32Array {
  const srcSet = filters.sources.length ? new Set(filters.sources) : null;
  const stSet = filters.states.length ? new Set(filters.states) : null;
  const muSet = filters.municipalities.length ? new Set(filters.municipalities) : null;
  const catSet = filters.categories.length ? new Set(filters.categories) : null;
  const q = filters.search.trim().toLowerCase();
  const out = new Uint32Array(f.n.length);
  let k = 0;
  for (let i = 0; i < f.n.length; i++) {
    if (srcSet && !srcSet.has(f.s[i]!)) continue;
    if (stSet && !stSet.has(f.st[i]!)) continue;
    if (muSet && !muSet.has(f.mu[i]!)) continue;
    if (catSet && !catSet.has(f.c[i]!)) continue;
    const w = f.w[i]!;
    if (w < filters.minDemand || w > filters.maxDemand) continue;
    if (q && !f.n[i]!.toLowerCase().includes(q)) continue;
    out[k++] = i;
  }
  return out.subarray(0, k);
}

export type Agg = { key: string; label: string; value: number; count: number };

function rank(map: Map<number, { v: number; c: number }>, labels: string[]): Agg[] {
  return [...map.entries()]
    .map(([i, o]) => ({ key: String(i), label: labels[i] ?? "Unknown", value: o.v, count: o.c }))
    .sort((a, b) => b.value - a.value);
}

export type CompRow = { cat: string; prod: number; emp: number; floor: number; total: number };

export function aggregate(f: Facilities, idx: Uint32Array, meta: Meta) {
  const byCat = new Map<number, { v: number; c: number }>();
  const bySt = new Map<number, { v: number; c: number }>();
  const byMu = new Map<number, { v: number; c: number }>();
  const bySrc = new Map<number, { v: number; c: number }>();
  const byUnido = new Map<number, { v: number; c: number }>();
  const comp = new Map<number, { p: number; e: number; fl: number }>();
  let total = 0;
  let floor = 0;
  let area = 0;
  let prod = 0;
  let emp = 0;
  const bump = (m: Map<number, { v: number; c: number }>, key: number, v: number) => {
    const cur = m.get(key);
    if (cur) {
      cur.v += v;
      cur.c += 1;
    } else m.set(key, { v, c: 1 });
  };
  for (let j = 0; j < idx.length; j++) {
    const i = idx[j]!;
    const w = f.w[i]!;
    const p = f.pw[i] ?? 0;
    const e = f.ew[i] ?? 0;
    const fl = f.fw[i]!;
    total += w;
    floor += fl;
    area += f.a[i]!;
    prod += p;
    emp += e;
    const ci = f.c[i]!;
    const cc = comp.get(ci);
    if (cc) {
      cc.p += p;
      cc.e += e;
      cc.fl += fl;
    } else comp.set(ci, { p, e, fl });
    bump(byCat, ci, w);
    bump(bySt, f.st[i]!, w);
    bump(byMu, f.mu[i]!, w);
    bump(bySrc, f.s[i]!, w);
    bump(byUnido, f.u[i]!, w);
  }
  const components: CompRow[] = [...comp.entries()]
    .map(([i, o]) => ({
      cat: meta.categories[i] ?? "Unknown",
      prod: o.p,
      emp: o.e,
      floor: o.fl,
      total: o.p + o.e + o.fl,
    }))
    .sort((a, b) => b.total - a.total);
  return {
    count: idx.length,
    total,
    floor,
    area,
    prod,
    emp,
    components,
    byCategory: rank(byCat, meta.categories),
    byState: rank(bySt, meta.states),
    byMunicipality: rank(byMu, meta.municipalities),
    bySource: rank(bySrc, meta.sources),
    byUnido: rank(byUnido, meta.unido),
  };
}

export type Aggregates = ReturnType<typeof aggregate>;

/** Maps detailed UNIDO sectors onto the broader industry categories used across the dashboard. */
export const UNIDO_TO_BROAD: Record<string, string> = {
  "Basic Metals": "Basic metals & metal products",
  "Fabricated Metal Products (except machinery)": "Basic metals & metal products",
  Beverages: "Food & beverages",
  "Food Products": "Food & beverages",
  "Tobacco Products": "Food & beverages",
  "Chemicals and Chemical Products": "Chemicals & products",
  "Coke and Refined Petroleum Products": "Coke and refined petroleum products",
  "Computer, Electronic, and Optical Products":
    "Computer, electronic, electrical & optical products",
  "Electrical Equipment": "Computer, electronic, electrical & optical products",
  "Electricity, Gas, Steam, and Air Conditioning Supply": "Electricity, gas, steam & air conditioning",
  "Extraction of crude petroleum and natural gas": "Mining, extraction of petroleum & gas",
  "Mining of metal ores": "Mining, extraction of petroleum & gas",
  "Mining support service activities": "Mining, extraction of petroleum & gas",
  "Other mining and quarrying": "Mining, extraction of petroleum & gas",
  Furniture: "Wood & Furniture",
  "Wood Products (excluding furniture)": "Wood & Furniture",
  "Leather and Related Products": "Textile & Apparel",
  Textiles: "Textile & Apparel",
  "Wearing Apparel": "Textile & Apparel",
  "Machinery and Equipment n.e.c.": "Machinery, equipment & manufacturing",
  "Repair and Installation of Machinery and Equipment": "Machinery, equipment & manufacturing",
  "Motor Vehicles, Trailers, and Semi-Trailers": "Motor vehicles & transport equipment",
  "Other Transport Equipment": "Motor vehicles & transport equipment",
  "Other Manufacturing": "Other Manufacturing",
  "Other Non-Metallic Mineral Products": "Non-metallic mineral products",
  "Paper and Paper Products": "Paper, paper products & printing",
  "Printing and Reproduction of Recorded Media": "Paper, paper products & printing",
  "Pharmaceuticals, Medicinal Chemicals, etc.": "Pharma, medicinal chemicals, etc.",
  "Rubber and Plastics Products": "Rubber and plastics products",
  "Waste Collection, Treatment, and Disposal Activities": "Waste management",
  "Water Collection, Treatment, and Supply": "Water management",
};

/** Detailed UNIDO econ rows collapsed into the broad industry categories. */
export function broadEconRows(econ: EconSet): EconRow[] {
  const map = new Map<string, EconRow>();
  for (const r of econ.rows) {
    const cat = UNIDO_TO_BROAD[r.cat] ?? r.cat;
    const cur = map.get(cat);
    if (cur) {
      cur.floor += r.floor;
      cur.usd += r.usd;
      cur.prod += r.prod;
      cur.emp += r.emp;
      cur.empW += r.empW;
      cur.total += r.total;
    } else {
      map.set(cat, { ...r, cat });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export const CATEGORY_COLORS = [
  // IWMI palette: blue-dominant, a little teal/green, a few orange accents.
  "#0B3A6F", // navy
  "#155C97", // IWMI blue
  "#1E7BB8", // azure
  "#3A9AD1", // bright blue
  "#5FB3DE", // sky
  "#0E4E77", // deep petrol blue
  "#2A6FA3", // medium blue
  "#7EC4E8", // light sky
  "#12708C", // blue-teal
  "#1B95A8", // teal
  "#4FB3C0", // soft teal
  "#3D5A80", // slate blue
  "#1D4E6B", // marine
  "#88B7D9", // pale blue
  "#2E8B72", // muted green
  "#E1751F", // IWMI orange
  "#F0A04B", // warm amber
  "#B8541A", // deep burnt orange
  "#A8CBE3", // ice blue
];


/**
 * Deeper blue–cyan tones for the map scatter so dots stay legible
 * over raster tiles and avoid any green tint.
 */
export const MAP_DOT_COLORS = [
  "#0A2F5C",
  "#134C7D",
  "#1A6BA0",
  "#2E86B8",
  "#0E3B5A",
  "#3A7CA5",
  "#155C97",
  "#072A52",
  "#2A6FA3",
  "#4E9AB8",
  "#12617A",
  "#1B7F92",
  "#3F9AA8",
  "#0D3B54",
  "#2E7A63",
  "#C4661A",
  "#E08A3C",
  "#8F4413",
  "#2A4463",
];

export const catColor = (i: number) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]!;
export const mapDotColor = (i: number) => MAP_DOT_COLORS[i % MAP_DOT_COLORS.length]!;

export function fmtVolume(m3: number) {
  if (m3 >= 1e9) return `${(m3 / 1e9).toFixed(3)} km³`;
  if (m3 >= 1e6) return `${(m3 / 1e6).toFixed(2)} hm³`;
  if (m3 >= 1e3) return `${(m3 / 1e3).toFixed(2)} dam³`;
  return `${m3.toFixed(1)} m³`;
}

export function fmtNum(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
/** Compact display names for the long UNIDO / broad industry category labels. */
export const SHORT_LABELS: Record<string, string> = {
  "Computer, electronic, electrical & optical products": "Computer & electronics",
  "Machinery, equipment & manufacturing": "Machinery & equipment",
  "Motor vehicles & transport equipment": "Motor vehicles & transport",
  "Electricity, gas, steam & air conditioning": "Electricity, gas & steam",
  "Mining, extraction of petroleum & gas": "Mining, petroleum & gas",
  "Coke and refined petroleum products": "Coke & refined petroleum",
  "Paper, paper products & printing": "Paper & printing",
  "Pharma, medicinal chemicals, etc.": "Pharmaceuticals",
  "Non-metallic mineral products": "Non-metallic minerals",
  "Basic metals & metal products": "Basic & fabricated metals",
  "Rubber and plastics products": "Rubber & plastics",
};

export function shortLabel(label: string, max = 28) {
  const s = SHORT_LABELS[label] ?? label;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
