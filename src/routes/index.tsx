import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Droplets, Factory, LandPlot, Layers, Gauge, RotateCcw } from "lucide-react";
import {
  aggregate,
  catColor,
  mapDotColor,
  filterIndices,
  fmtNum,
  fmtVolume,
  loadFacilities,
  loadMeta,
  shortLabel,
  THRESHOLDS,
  type Filters,
  type Threshold,
} from "@/lib/dashboard-data";
import { MultiSelect } from "@/components/dashboard/MultiSelect";
import { MapPanel } from "@/components/dashboard/MapPanel";
import {
  CategoryBar,
  EconChart,
  IntensityScatter,
  RankBar,
  SourceDonut,
} from "@/components/dashboard/Charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LanguageToggle } from "@/components/dashboard/LanguageToggle";
import { useI18n } from "@/lib/i18n";
import logoIwmi from "@/assets/logo-iwmi.png";
import logoConagua from "@/assets/logo-conagua.png";
import logoGoogleOrg from "@/assets/logo-googleorg.png";
import logoCgiar from "@/assets/logo-cgiar.avif";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lerma–Santiago Industrial Water Demand Dashboard" },
      {
        name: "description",
        content:
          "Interactive dashboard of industrial water demand across the Lerma–Santiago basin: 60,000+ sites, footprint thresholds, states, municipalities and industry categories.",
      },
      { property: "og:title", content: "Lerma–Santiago Industrial Water Demand Dashboard" },
      {
        property: "og:description",
        content:
          "Explore industrial water demand by footprint threshold, data source, state, municipality and industry category.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const DEFAULT_FILTERS: Filters = {
  sources: [],
  states: [],
  municipalities: [],
  categories: [],
  minDemand: 0,
  maxDemand: Number.POSITIVE_INFINITY,
  search: "",
};

export function Dashboard() {
  const { t } = useI18n();
  const [threshold, setThreshold] = useState<Threshold>(250);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const metaQ = useQuery({ queryKey: ["meta"], queryFn: loadMeta, staleTime: Infinity });
  const facQ = useQuery({
    queryKey: ["facilities", threshold],
    queryFn: () => loadFacilities(threshold),
    staleTime: Infinity,
  });

  const meta = metaQ.data;
  const facilities = facQ.data;
  const econ = meta?.econ[String(threshold)];

  const maxDemand = useMemo(() => (facilities ? Math.max(...facilities.w) : 0), [facilities]);

  const effFilters = useMemo<Filters>(
    () => ({
      ...filters,
      minDemand: 0,
      maxDemand: maxDemand || Infinity,
    }),
    [filters, maxDemand],
  );

  const indices = useMemo(
    () => (facilities ? filterIndices(facilities, effFilters) : new Uint32Array()),
    [facilities, effFilters],
  );

  const agg = useMemo(
    () => (facilities && meta ? aggregate(facilities, indices, meta) : null),
    [facilities, indices, meta],
  );

  const prodWater = agg?.prod ?? 0;
  const empWater = agg?.emp ?? 0;
  const loading = metaQ.isLoading || facQ.isLoading;

  return (
    <div className="aurora min-h-screen bg-background">
      <header
        className="sticky top-0 z-30 border-b border-white/15 text-header-foreground shadow-[0_10px_30px_-20px_oklch(0.5_0.15_200)] backdrop-blur-xl"
        style={{ backgroundImage: "var(--gradient-header)" }}
      >
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="live-dot grid size-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/30">
              <Droplets className="size-5" />
            </span>
            <h1 className="text-base font-bold tracking-wide uppercase sm:text-lg">
              {t("app.title")}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
              {THRESHOLDS.map((v) => (
                <button
                  key={v}
                  onClick={() => setThreshold(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95 ${
                    threshold === v
                      ? "bg-white text-header shadow-[0_6px_18px_-8px_oklch(0.2_0.05_240)]"
                      : "text-header-foreground/80 hover:bg-white/15"
                  }`}
                >
                  {v} m²
                </button>
              ))}
            </div>
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] space-y-4 p-4">
        {/* Filters */}
        <section className="panel panel-pop glow-ring rise p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="panel-title">{t("filters.title")}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters(DEFAULT_FILTERS)}

            >
              <RotateCcw className="mr-1.5 size-3.5" /> {t("filters.reset")}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MultiSelect
              label={t("filters.source")}
              options={meta?.sources ?? []}
              selected={filters.sources}
              onChange={(v) => setFilters((f) => ({ ...f, sources: v }))}
            />
            <MultiSelect
              label={t("filters.state")}
              options={meta?.states ?? []}
              selected={filters.states}
              onChange={(v) => setFilters((f) => ({ ...f, states: v }))}
            />
            <MultiSelect
              label={t("filters.municipality")}
              options={meta?.municipalities ?? []}
              selected={filters.municipalities}
              onChange={(v) => setFilters((f) => ({ ...f, municipalities: v }))}
            />
            <MultiSelect
              label={t("filters.category")}
              options={meta?.categories ?? []}
              selected={filters.categories}
              onChange={(v) => setFilters((f) => ({ ...f, categories: v }))}
              colors={catColor}
            />
            <Input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder={t("filters.search")}
              className="h-9 bg-card"
            />
          </div>

        </section>

        {/* KPIs */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi
            icon={<Droplets className="size-4" />}
            label={t("kpi.total")}
            value={agg ? fmtVolume(agg.total) : "—"}
            hint={t("kpi.total.hint")}
          />
          <Kpi
            icon={<Factory className="size-4" />}
            label={t("kpi.sites")}
            value={agg ? fmtNum(agg.count) : "—"}
            hint={t("kpi.sites.hint", { n: fmtNum(facilities?.n.length ?? 0), t: threshold })}
          />
          <Kpi
            icon={<LandPlot className="size-4" />}
            label={t("kpi.prod")}
            value={agg ? fmtVolume(prodWater) : "—"}
            hint={t("kpi.prod.hint")}
          />
          <Kpi
            icon={<Gauge className="size-4" />}
            label={t("kpi.emp")}
            value={agg ? fmtVolume(empWater) : "—"}
            hint={t("kpi.emp.hint")}
          />
          <Kpi
            icon={<Layers className="size-4" />}
            label={t("kpi.floor")}
            value={agg ? fmtVolume(agg.floor) : "—"}
            hint={t("kpi.floor.hint")}
          />
        </section>

        {/* Map + side ranks */}
        <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="panel panel-pop glow-ring rise overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <h2 className="panel-title">{t("map.title")}</h2>
              <span className="text-xs text-muted-foreground">
                {t("map.hint", { n: agg ? fmtNum(agg.count) : 0 })}
              </span>
            </div>
            <div className="h-[560px]">
              {facilities && meta && (
                <MapPanel
                  facilities={facilities}
                  indices={indices}
                  meta={meta}
                  selectedStates={filters.states}
                  selectedMunicipalities={filters.municipalities}
                  onToggleState={(i) =>
                    setFilters((f) => ({
                      ...f,
                      states: f.states.includes(i)
                        ? f.states.filter((x) => x !== i)
                        : [...f.states, i],
                    }))
                  }
                  onToggleMunicipality={(i) =>
                    setFilters((f) => ({
                      ...f,
                      municipalities: f.municipalities.includes(i)
                        ? f.municipalities.filter((x) => x !== i)
                        : [...f.municipalities, i],
                    }))
                  }
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border px-4 py-2 sm:grid-cols-3 xl:grid-cols-4">
              {(meta?.categories ?? []).map((c, i) => (
                <span
                  key={c}
                  title={c}
                  className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: mapDotColor(i) }}
                  />
                  <span className="truncate">{shortLabel(c, 30)}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="panel panel-pop glow-ring rise flex flex-col overflow-hidden">
            <div className="border-b border-border px-4 py-2.5">
              <h2 className="panel-title">{t("cat.title")}</h2>
            </div>
            <div className="max-h-[640px] overflow-y-auto p-2">
              {agg && <CategoryBar data={agg.byCategory} />}
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="panel panel-pop glow-ring rise overflow-hidden">
            <Tabs defaultValue="states">
              <TabsList className="m-2">
                <TabsTrigger value="states">{t("tabs.states")}</TabsTrigger>
                <TabsTrigger value="munis">{t("tabs.munis")}</TabsTrigger>
                <TabsTrigger value="sources">{t("tabs.sources")}</TabsTrigger>
              </TabsList>
              <div className="max-h-[520px] overflow-y-auto p-3">
                <TabsContent value="states">
                  {agg && <RankBar data={agg.byState} />}
                </TabsContent>
                <TabsContent value="munis">
                  {agg && (
                    <RankBar
                      data={agg.byMunicipality.slice(0, 25)}
                      color="var(--chart-2)"
                      categoryKey="chart.axis.municipality"
                    />
                  )}
                </TabsContent>
                <TabsContent value="sources">{agg && <SourceDonut data={agg.bySource} />}</TabsContent>
              </div>
            </Tabs>
          </div>

          <div className="panel panel-pop glow-ring rise overflow-hidden">
            <Tabs defaultValue="components">
              <TabsList className="m-2">
                <TabsTrigger value="components">{t("tabs.components")}</TabsTrigger>
                <TabsTrigger value="intensity">{t("tabs.intensity")}</TabsTrigger>
              </TabsList>
              <div className="max-h-[520px] overflow-y-auto p-3">
                <TabsContent value="components">{agg && <EconChart rows={agg.components} />}</TabsContent>
                <TabsContent value="intensity">{econ && <IntensityScatter econ={econ} />}</TabsContent>
              </div>
            </Tabs>
          </div>
        </section>

        {/* Table */}
        <section className="panel panel-pop glow-ring rise overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h2 className="panel-title">{t("table.title")}</h2>
            <span className="text-xs text-muted-foreground">{t("table.hint")}</span>
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-semibold">{t("table.industry")}</th>
                  <th className="px-4 py-2 font-semibold">{t("table.category")}</th>
                  <th className="px-4 py-2 font-semibold">{t("table.municipality")}</th>
                  <th className="px-4 py-2 font-semibold">{t("table.state")}</th>
                  <th className="px-4 py-2 font-semibold">{t("table.source")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{t("table.area")}</th>
                  <th className="px-4 py-2 text-right font-semibold">{t("table.demand")}</th>
                </tr>
              </thead>
              <tbody>
                {facilities &&
                  meta &&
                  [...indices]
                    .sort((a, b) => facilities.w[b]! - facilities.w[a]!)
                    .slice(0, 100)
                    .map((i) => (
                      <tr key={i} className="border-t border-border/60 transition-colors hover:bg-accent/15 hover:shadow-[inset_3px_0_0_0_var(--aqua)]">
                        <td className="px-4 py-1.5">{facilities.n[i]}</td>
                        <td className="px-4 py-1.5">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: catColor(facilities.c[i]!) }}
                            />
                            {meta.categories[facilities.c[i]!]}
                          </span>
                        </td>
                        <td className="px-4 py-1.5">{meta.municipalities[facilities.mu[i]!]}</td>
                        <td className="px-4 py-1.5">{meta.states[facilities.st[i]!]}</td>
                        <td className="px-4 py-1.5">{meta.sources[facilities.s[i]!]}</td>
                        <td className="px-4 py-1.5 text-right tabular-nums">
                          {fmtNum(facilities.a[i]!)}
                        </td>
                        <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                          {facilities.w[i]!.toFixed(1)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {loading && (
              <p className="p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
            )}
          </div>
        </section>

        <footer className="space-y-4 border-t border-border pb-10 pt-6 text-center">
          <div className="flex flex-wrap items-center justify-center divide-x divide-border">
            <div className="flex items-center gap-3 px-8 py-1">
              <img
                src={logoIwmi}
                alt="IWMI logo"
                loading="lazy"
                className="h-9 w-auto max-w-[132px] object-contain"
              />
              <span className="max-w-[190px] text-left text-[11px] leading-snug text-muted-foreground">
                {t("footer.iwmi")}
              </span>
            </div>
            <div className="flex items-center px-8 py-1">
              <img
                src={logoConagua}
                alt="CONAGUA logo"
                loading="lazy"
                className="h-14 w-auto max-w-[132px] object-contain"
              />
            </div>
            <div className="flex items-center px-8 py-1">
              <img
                src={logoCgiar}
                alt="CGIAR logo"
                loading="lazy"
                className="h-12 w-auto max-w-[132px] object-contain"
              />
            </div>
            <div className="flex items-center px-8 py-1">
              <img
                src={logoGoogleOrg}
                alt="Google.org logo"
                loading="lazy"
                className="h-7 w-auto max-w-[132px] object-contain"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("footer.rights")}</p>
        </footer>
      </main>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      tabIndex={0}
      className="panel panel-pop glow-ring kpi-sheen rise group relative overflow-hidden p-4 outline-none"
    >
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent/20 text-primary transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
          {icon}
        </span>
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
      </div>
      <p className="text-gradient mt-2 font-display text-2xl font-bold">{value}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{hint}</p>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-primary/95 px-4 py-2 text-[11px] leading-snug text-primary-foreground opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        {hint}
      </div>
    </div>

  );
}