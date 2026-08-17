import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { Agg, CompRow, EconSet } from "@/lib/dashboard-data";
import { broadEconRows, catColor, fmtVolume, shortLabel } from "@/lib/dashboard-data";
import { useI18n, type TKey } from "@/lib/i18n";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Shared style for axis titles so every chart labels its axes the same way. */
const axisTitle = {
  fill: "var(--foreground)",
  fontSize: 11,
  fontWeight: 600,
} as const;

const tooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
  },
};

/** Vertical (rotated) axis title placed clear of the tick labels. */
function verticalTitle(text: string) {
  return {
    value: text,
    angle: -90,
    position: "insideLeft" as const,
    offset: 0,
    style: { ...axisTitle, textAnchor: "middle" as const },
  };
}

function horizontalTitle(text: string) {
  return {
    value: text,
    position: "insideBottom" as const,
    offset: -12,
    style: { ...axisTitle, textAnchor: "middle" as const },
  };
}

export function CategoryBar({ data }: { data: Agg[] }) {
  const { t } = useI18n();
  const rows = data.map((d) => ({ ...d, mm3: d.value / 1e6 }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(300, rows.length * 26 + 56)}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ left: 24, right: 24, top: 8, bottom: 28 }}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          tick={axis}
          tickMargin={6}
          label={horizontalTitle(t("chart.axis.demand"))}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={186}
          tick={axis}
          tickMargin={6}
          interval={0}
          label={verticalTitle(t("chart.axis.category"))}
          tickFormatter={(v: string) => shortLabel(v, 26)}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => [`${v.toFixed(2)} hm³/yr`, t("chart.tooltip.demand")]}
          labelFormatter={(l: string) => l}
        />
        <Bar dataKey="mm3" radius={[0, 4, 4, 0]}>
          {rows.map((r) => (
            <Cell key={r.key} fill={catColor(Number(r.key))} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RankBar({
  data,
  color = "var(--chart-1)",
  categoryKey = "chart.axis.state",
}: {
  data: Agg[];
  color?: string;
  categoryKey?: TKey;
}) {
  const { t } = useI18n();
  const rows = data.map((d) => ({ ...d, mm3: d.value / 1e6 }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(280, rows.length * 24 + 56)}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ left: 24, right: 24, top: 8, bottom: 28 }}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          tick={axis}
          tickMargin={6}
          label={horizontalTitle(t("chart.axis.demand"))}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={170}
          tick={axis}
          tickMargin={6}
          interval={0}
          label={verticalTitle(t(categoryKey))}
          tickFormatter={(v: string) => shortLabel(v, 24)}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, _n, p) => [
            `${v.toFixed(3)} hm³/yr · ${p.payload.count.toLocaleString("en-US")} ${t("chart.tooltip.sites")}`,
            t("chart.tooltip.demand"),
          ]}
        />
        <Bar dataKey="mm3" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SourceDonut({ data }: { data: Agg[] }) {
  const { t } = useI18n();
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((d, i) => (
            <Cell key={d.key} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number, n, p) => [
            `${v.toLocaleString("en-US")} ${t("chart.tooltip.sites")} · ${fmtVolume(p.payload.value)}/yr`,
            n,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function EconChart({ rows: input }: { rows: CompRow[] }) {
  const { t } = useI18n();
  const sProd = t("chart.series.production");
  const sEmp = t("chart.series.employees");
  const sFloor = t("chart.series.floor");
  const rows = input.map((r) => ({
    cat: r.cat,
    [sProd]: r.prod / 1e6,
    [sEmp]: r.emp / 1e6,
    [sFloor]: r.floor / 1e6,
    total: r.total / 1e6,
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(360, rows.length * 26 + 96)}>
      <ComposedChart
        data={rows}
        layout="vertical"
        margin={{ left: 24, right: 24, top: 8, bottom: 28 }}
      >
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          tick={axis}
          tickMargin={6}
          label={horizontalTitle(t("chart.axis.demand"))}
        />
        <YAxis
          type="category"
          dataKey="cat"
          width={186}
          tick={axis}
          tickMargin={6}
          interval={0}
          label={verticalTitle(t("chart.axis.category"))}
          tickFormatter={(v: string) => shortLabel(v, 26)}
        />
        <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} hm³/yr`} />
        <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" />
        <Bar dataKey={sProd} stackId="a" fill="var(--chart-1)" />
        <Bar dataKey={sEmp} stackId="a" fill="var(--chart-2)" />
        <Bar dataKey={sFloor} stackId="a" fill="var(--chart-3)" radius={[0, 4, 4, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function IntensityScatter({ econ }: { econ: EconSet }) {
  const { t } = useI18n();
  const rows = broadEconRows(econ)
    .filter((r) => r.usd > 0)
    .map((r) => ({
      x: r.usd,
      y: r.total * 1000,
      z: r.emp,
      cat: r.cat,
      intensity: r.usd ? (r.total * 1e9) / r.usd : 0,
    }));
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ScatterChart margin={{ left: 24, right: 24, top: 12, bottom: 32 }}>
        <CartesianGrid stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="x"
          name={t("chart.series.production")}
          tick={axis}
          tickMargin={6}
          label={horizontalTitle(t("chart.axis.production"))}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={t("chart.tooltip.demand")}
          tick={axis}
          tickMargin={6}
          width={78}
          label={verticalTitle(t("chart.axis.demand"))}
        />
        <ZAxis type="number" dataKey="z" range={[40, 500]} name={t("chart.series.employees")} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ strokeDasharray: "3 3" }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
            if (!p) return null;
            return (
              <div className="rounded-md border border-border bg-card p-2 text-xs shadow-md">
                <strong>{p.cat}</strong>
                <div>
                  {t("chart.series.production")}: {p.x.toFixed(0)} M USD
                </div>
                <div>
                  {t("chart.tooltip.demand")}: {p.y.toFixed(2)} hm³/yr
                </div>
                <div>
                  {t("chart.series.employees")}: {p.z.toLocaleString("en-US")}
                </div>
                <div>{t("chart.scatter.intensity", { v: p.intensity.toFixed(1) })}</div>
              </div>
            );
          }}
        />
        <Scatter data={rows} fill="var(--chart-1)" fillOpacity={0.75} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
