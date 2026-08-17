import { useEffect, useRef, useState } from "react";
import type { Map as MapType } from "maplibre-gl";
import type { Facilities, Meta } from "@/lib/dashboard-data";
import { fmtVolume, mapDotColor } from "@/lib/dashboard-data";
import { useI18n, type TKey } from "@/lib/i18n";

type Props = {
  facilities: Facilities;
  indices: Uint32Array;
  meta: Meta;
  selectedStates: number[];
  selectedMunicipalities: number[];
  onToggleState: (i: number) => void;
  onToggleMunicipality: (i: number) => void;
};

const MAX_POINTS = 30000;

type LayerId = "basin" | "states" | "municipalities" | "parks" | "buildings";

type LayerDef = {
  id: LayerId;
  label: TKey;
  url: string;
  color: string;
  fill?: string;
  width: number;
};

/**
 * GIS overlays are drawn on the same 2D canvas as the facility dots (instead of
 * MapLibre vector layers) so they work without the MapLibre web worker.
 */
const GIS_LAYERS: LayerDef[] = [
  {
    id: "basin",
    label: "layer.basin",
    url: "/data/basin.json",
    color: "#0B3A6F",
    fill: "rgba(11,58,111,0.06)",
    width: 1.8,
  },
  {
    id: "states",
    label: "layer.states",
    url: "/data/states.json",
    color: "#1D6FA5",
    width: 1.4,
  },
  {
    id: "municipalities",
    label: "layer.municipalities",
    url: "/data/municipalities.json",
    color: "#4A8FBF",
    width: 0.6,
  },
  {
    id: "parks",
    label: "layer.parks",
    url: "/data/industry-parks.json",
    color: "#0F5A7A",
    fill: "rgba(15,90,122,0.35)",
    width: 1.4,
  },
  {
    id: "buildings",
    label: "layer.buildings",
    url: "/data/industry-buildings.json",
    color: "#2F7FA8",
    width: 0,
  },
];

type Ring = Float64Array; // [lon, lat, lon, lat, ...]
type Poly = {
  rings: Ring[];
  bbox: [number, number, number, number];
  /** adm2_name for municipalities, adm1_name for states */
  name?: string;
  stateName?: string;
};
type LayerData = { polys: Poly[] } | { pts: { lo: Float64Array; la: Float64Array } };

function ringFrom(coords: number[][]): Ring {
  const out = new Float64Array(coords.length * 2);
  for (let i = 0; i < coords.length; i++) {
    out[i * 2] = coords[i]![0]!;
    out[i * 2 + 1] = coords[i]![1]!;
  }
  return out;
}

function bboxOf(rings: Ring[]): [number, number, number, number] {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) {
      const x = r[i]!;
      const y = r[i + 1]!;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return [x0, y0, x1, y1];
}

async function loadLayerData(id: LayerId, url: string): Promise<LayerData> {
  const raw = await (await fetch(url)).json();
  if (id === "buildings") {
    const { lo, la } = raw as { lo: number[]; la: number[] };
    return { pts: { lo: Float64Array.from(lo), la: Float64Array.from(la) } };
  }
  const polys: Poly[] = [];
  for (const f of raw.features ?? []) {
    const g = f?.geometry;
    if (!g) continue;
    const parts: number[][][][] =
      g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    const props = (f?.properties ?? {}) as { adm1_name?: string; adm2_name?: string };
    const name = id === "municipalities" ? props.adm2_name : id === "states" ? props.adm1_name : undefined;
    for (const poly of parts) {
      const rings = poly.map((r) => ringFrom(r as unknown as number[][]));
      if (rings.length)
        polys.push({
          rings,
          bbox: bboxOf(rings),
          ...(name ? { name } : {}),
          ...(props.adm1_name ? { stateName: props.adm1_name } : {}),
        });
    }
  }
  return { polys };
}

function pointInPoly(poly: Poly, x: number, y: number) {
  const [x0, y0, x1, y1] = poly.bbox;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  let inside = false;
  for (const r of poly.rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i]!;
      const yi = r[i + 1]!;
      const xj = r[j]!;
      const yj = r[j + 1]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

export function MapPanel({
  facilities,
  indices,
  meta,
  selectedStates,
  selectedMunicipalities,
  onToggleState,
  onToggleMunicipality,
}: Props) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapType | null>(null);
  const dataRef = useRef({ facilities, indices, meta });
  dataRef.current = { facilities, indices, meta };
  /** "municipality" when the municipality layer is on, otherwise "state" */
  const [pickLevel, setPickLevel] = useState<"state" | "municipality">("state");
  const selRef = useRef({ selectedStates, selectedMunicipalities, pickLevel });
  selRef.current = { selectedStates, selectedMunicipalities, pickLevel };
  const cbRef = useRef({ onToggleState, onToggleMunicipality });
  cbRef.current = { onToggleState, onToggleMunicipality };

  const [active, setActive] = useState<Record<LayerId, boolean>>({
    basin: true,
    states: false,
    municipalities: false,
    parks: false,
    buildings: false,
  });
  const [busy, setBusy] = useState<LayerId | null>(null);
  const layerData = useRef<Partial<Record<LayerId, LayerData>>>({});
  const activeRef = useRef(active);
  activeRef.current = active;

  // Sampled subset actually drawn (index into facilities arrays)
  const sample = useRef<Uint32Array>(new Uint32Array());
  const step = Math.max(1, Math.ceil(indices.length / MAX_POINTS));
  {
    const out = new Uint32Array(Math.ceil(indices.length / step));
    for (let j = 0, k = 0; j < indices.length; j += step, k++) out[k] = indices[j]!;
    sample.current = out;
  }

  const drawRef = useRef<() => void>(() => {});

  function draw() {
    const map = mapRef.current;
    const cv = overlay.current;
    if (!map || !cv) return;
    const { facilities: f } = dataRef.current;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const bounds = map.getBounds();
    const vx0 = bounds.getWest();
    const vy0 = bounds.getSouth();
    const vx1 = bounds.getEast();
    const vy1 = bounds.getNorth();

    // 1. GIS overlays (polygons first, then building points)
    for (const def of GIS_LAYERS) {
      if (!activeRef.current[def.id]) continue;
      const data = layerData.current[def.id];
      if (!data || !("polys" in data)) continue;
      ctx.lineWidth = def.width;
      ctx.strokeStyle = def.color;
      for (const poly of data.polys) {
        const [x0, y0, x1, y1] = poly.bbox;
        if (x1 < vx0 || x0 > vx1 || y1 < vy0 || y0 > vy1) continue;
        ctx.beginPath();
        for (const r of poly.rings) {
          for (let i = 0; i < r.length; i += 2) {
            const p = map.project([r[i]!, r[i + 1]!]);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
        }
        if (def.fill) {
          ctx.fillStyle = def.fill;
          ctx.fill("evenodd");
        }
        ctx.stroke();
      }
    }

    // 1b. Highlight selected administrative areas (regardless of layer toggles)
    const { meta: md0 } = dataRef.current;
    for (const [lid, names] of [
      ["states", selRef.current.selectedStates.map((i) => md0.states[i])],
      ["municipalities", selRef.current.selectedMunicipalities.map((i) => md0.municipalities[i])],
    ] as const) {
      if (!names.length) continue;
      const data = layerData.current[lid];
      if (!data || !("polys" in data)) continue;
      const set = new Set(names);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = "#B45309";
      ctx.fillStyle = "rgba(245,158,11,0.18)";
      for (const poly of data.polys) {
        if (!poly.name || !set.has(poly.name)) continue;
        const [x0, y0, x1, y1] = poly.bbox;
        if (x1 < vx0 || x0 > vx1 || y1 < vy0 || y0 > vy1) continue;
        ctx.beginPath();
        for (const r of poly.rings) {
          for (let i = 0; i < r.length; i += 2) {
            const p = map.project([r[i]!, r[i + 1]!]);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.closePath();
        }
        ctx.fill("evenodd");
        ctx.stroke();
      }
    }

    const buildings = layerData.current.buildings;
    if (activeRef.current.buildings && buildings && "pts" in buildings) {
      const { lo, la } = buildings.pts;
      const zoom = map.getZoom();
      const r = zoom < 7 ? 0.9 : zoom < 10 ? 1.6 : 3;
      ctx.fillStyle = "#2F7FA8";
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < lo.length; i++) {
        const x = lo[i]!;
        const y = la[i]!;
        if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
        const p = map.project([x, y]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 2. Facility dots (flat, crisp)
    const zoom = map.getZoom();
    const base = 0.65 + Math.max(0, zoom - 4) * 0.3;
    const ids = sample.current;

    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    for (let k = 0; k < ids.length; k++) {
      const i = ids[k]!;
      const p = map.project([f.lo[i]!, f.la[i]!]);
      if (p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) continue;
      const r = base * (1 + Math.min(1.6, Math.sqrt(f.w[i]! / 9000)));
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = mapDotColor(f.c[i]!);
      ctx.fill();
      if (r > 2.2) ctx.stroke();
    }
    ctx.globalAlpha = 1;

  }
  drawRef.current = draw;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Map: MapLibreMap, NavigationControl } = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !container.current || mapRef.current) return;
        const m = new MapLibreMap({
          container: container.current,
          style: {
            version: 8,
            sources: {
              carto: {
                type: "raster",
                tiles: [
                  "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
                  "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
                  "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
                ],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors © CARTO",
              },
            },
            layers: [{ id: "carto", type: "raster", source: "carto" }],
          },

          center: [-102.2, 20.9],
          zoom: 5.2,
        });
        mapRef.current = m;
        m.addControl(new NavigationControl({ showCompass: false }), "top-left");
        const redraw = () => drawRef.current();
        m.on("move", redraw);
        m.on("zoom", redraw);
        m.on("resize", redraw);
        m.on("load", redraw);
        m.on("click", (ev) => {
          const level = selRef.current.pickLevel;
          const lid: LayerId = level === "municipality" ? "municipalities" : "states";
          const data = layerData.current[lid];
          if (!data || !("polys" in data)) return;
          const { lng, lat } = ev.lngLat;
          const hit = data.polys.find((poly) => pointInPoly(poly, lng, lat));
          if (!hit?.name) return;
          const md = dataRef.current.meta;
          const i =
            level === "municipality"
              ? md.municipalities.indexOf(hit.name)
              : md.states.indexOf(hit.name);
          if (i < 0) return;
          if (level === "municipality") cbRef.current.onToggleMunicipality(i);
          else cbRef.current.onToggleState(i);
        });
        redraw();

        // Preload administrative boundaries so clicking works immediately
        for (const lid of ["states", "municipalities"] as const) {
          if (layerData.current[lid]) continue;
          const def = GIS_LAYERS.find((d) => d.id === lid)!;
          loadLayerData(lid, def.url)
            .then((d) => {
              if (cancelled) return;
              layerData.current[lid] = d;
              drawRef.current();
            })
            .catch((err) => console.error(`Failed to preload ${lid}`, err));
        }
      } catch (err) {
        console.error("MapPanel init failed", err);
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Lazily fetch overlay data the first time a layer is switched on
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const def of GIS_LAYERS) {
        if (!active[def.id] || layerData.current[def.id]) continue;
        setBusy(def.id);
        try {
          const data = await loadLayerData(def.id, def.url);
          if (cancelled) return;
          layerData.current[def.id] = data;
          drawRef.current();
        } catch (err) {
          console.error(`Failed to load layer ${def.id}`, err);
        } finally {
          if (!cancelled) setBusy(null);
        }
      }
      if (!cancelled) drawRef.current();
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    drawRef.current();
  });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const map = mapRef.current;
    const el = tip.current;
    const cv = overlay.current;
    if (!map || !el || !cv) return;
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { facilities: f, meta: md } = dataRef.current;
    const ids = sample.current;
    let best = -1;
    let bestD = 64;
    for (let k = 0; k < ids.length; k++) {
      const i = ids[k]!;
      const p = map.project([f.lo[i]!, f.la[i]!]);
      const d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    el.style.left = `${Math.min(mx + 14, rect.width - 250)}px`;
    el.style.top = `${Math.max(8, my - 10)}px`;
    el.innerHTML = `<strong>${escapeHtml(f.n[best] ?? "")}</strong><br/>
      <span style="opacity:.75">${escapeHtml(md.categories[f.c[best]!] ?? "")}</span><br/>
      ${escapeHtml(md.municipalities[f.mu[best]!] ?? "")}, ${escapeHtml(md.states[f.st[best]!] ?? "")}<br/>
      Source: ${escapeHtml(md.sources[f.s[best]!] ?? "")}<br/>
      <strong>${fmtVolume(f.w[best]!)}/yr</strong>`;
  }

  return (
    <div
      className="relative h-full w-full"
      onMouseMove={onMove}
      onMouseLeave={() => {
        if (tip.current) tip.current.style.display = "none";
      }}
    >
      <div ref={container} className="h-full w-full cursor-pointer" />
      {/* hairline frame; no glow or vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          boxShadow: "inset 0 0 0 1px var(--border)",
        }}
      />


      <canvas
        ref={overlay}
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />

      <div className="absolute top-3 left-3 z-20 w-60 rounded-lg border border-border bg-card/95 p-3 shadow-md backdrop-blur" style={{ marginTop: "72px" }}>
        <div className="panel-title mb-2">{t("pick.title")}</div>
        <div className="mb-2 flex rounded-md bg-muted p-0.5">
          {(["state", "municipality"] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setPickLevel(lvl)}
              className={`flex-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                pickLevel === lvl
                  ? "bg-card text-card-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t(lvl === "state" ? "pick.state" : "pick.municipality")}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] leading-snug text-muted-foreground">{t("pick.hint")}</p>
        {(selectedStates.length > 0 || selectedMunicipalities.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedStates.map((i) => (
              <button
                key={`s${i}`}
                onClick={() => onToggleState(i)}
                className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground"
              >
                {meta.states[i]} ×
              </button>
            ))}
            {selectedMunicipalities.map((i) => (
              <button
                key={`m${i}`}
                onClick={() => onToggleMunicipality(i)}
                className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground"
              >
                {meta.municipalities[i]} ×
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="absolute top-3 right-3 z-20 w-56 rounded-lg border border-border bg-card/95 p-3 shadow-md backdrop-blur">
        <div className="panel-title mb-2">{t("layers.title")}</div>
        <div className="space-y-1.5">
          {GIS_LAYERS.map((def) => (
            <label
              key={def.id}
              title={t(def.label)}
              className="flex cursor-pointer items-center gap-2 text-[11.5px] text-card-foreground"
            >
              <input
                type="checkbox"
                checked={active[def.id]}
                onChange={(e) => setActive((s) => ({ ...s, [def.id]: e.target.checked }))}
                className="size-3.5 accent-[var(--color-primary)]"
              />
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: def.color }}
              />
              <span className="truncate">{t(def.label)}</span>
              {busy === def.id && (
                <span className="ml-auto text-[10px] text-muted-foreground">…</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div
        ref={tip}
        className="pointer-events-none absolute z-10 hidden max-w-[240px] rounded-md border border-border bg-card/95 p-2 text-[11px] leading-snug text-card-foreground shadow-md"
      />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as const)[
        c as "&"
      ]!,
  );
}
