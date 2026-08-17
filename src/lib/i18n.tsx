import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "es";

const dict = {
  "app.title": {
    en: "Industrial Water Demand, Lerma–Santiago Mexico",
    es: "Demanda de Agua Industrial, Lerma–Santiago México",
  },
  "lang.english": { en: "English", es: "Inglés" },
  "lang.spanish": { en: "Spanish", es: "Español" },
  "lang.label": { en: "Language", es: "Idioma" },

  "filters.title": { en: "Filters & thresholds", es: "Filtros y umbrales" },
  "filters.reset": { en: "Reset", es: "Restablecer" },
  "filters.source": { en: "Data source", es: "Fuente de datos" },
  "filters.state": { en: "State", es: "Estado" },
  "filters.category": { en: "Industry category", es: "Categoría industrial" },
  "filters.municipality": { en: "Municipality", es: "Municipio" },
  "filters.search": { en: "Search industry name…", es: "Buscar nombre de industria…" },
  "filters.perSite": { en: "Water demand per site", es: "Demanda de agua por sitio" },
  "select.search": { en: "Search", es: "Buscar" },
  "select.noMatches": { en: "No matches", es: "Sin resultados" },

  "kpi.total": { en: "Total water demand", es: "Demanda total de agua" },
  "kpi.total.hint": { en: "per year, filtered selection", es: "por año, selección filtrada" },
  "kpi.sites": { en: "Industrial sites", es: "Sitios industriales" },
  "kpi.sites.hint": { en: "of {n} at {t} m²", es: "de {n} con {t} m²" },
  "kpi.prod": { en: "Production-based water demand", es: "Demanda de agua por producción" },
  "kpi.prod.hint": {
    en: "from industrial production value",
    es: "según el valor de producción industrial",
  },
  "kpi.emp": { en: "Employee-based water demand", es: "Demanda de agua por empleo" },
  "kpi.emp.hint": { en: "from sector employment", es: "según el empleo sectorial" },
  "kpi.floor": { en: "Floor-area water use", es: "Uso de agua por superficie" },
  "kpi.floor.hint": { en: "WUI × floor area component", es: "componente WUI × superficie" },

  "map.title": { en: "Industrial site map", es: "Mapa de sitios industriales" },
  "map.hint": {
    en: "{n} sites · bubble size = water demand",
    es: "{n} sitios · tamaño de burbuja = demanda de agua",
  },
  "pick.title": { en: "Click map to filter", es: "Clic en el mapa para filtrar" },
  "pick.state": { en: "State", es: "Estado" },
  "pick.municipality": { en: "Municipality", es: "Municipio" },
  "pick.hint": {
    en: "Click an area on the map to filter every KPI, chart and table by it. Click again to clear.",
    es: "Haz clic en un área del mapa para filtrar los indicadores, gráficos y tablas. Haz clic de nuevo para quitarla.",
  },

  "layers.title": { en: "Map layers", es: "Capas del mapa" },
  "layer.basin": { en: "Lerma–Santiago basin", es: "Cuenca Lerma–Santiago" },
  "layer.states": { en: "States in basin", es: "Estados en la cuenca" },
  "layer.municipalities": { en: "Municipalities in basin", es: "Municipios en la cuenca" },
  "layer.parks": { en: "Industrial parks", es: "Parques industriales" },
  "layer.buildings": { en: "Industrial buildings > 1000 m²", es: "Edificios industriales > 1000 m²" },

  "cat.title": {
    en: "Water demand by industry category",
    es: "Demanda de agua por categoría industrial",
  },

  "tabs.states": { en: "States", es: "Estados" },
  "tabs.munis": { en: "Municipalities", es: "Municipios" },
  "tabs.sources": { en: "Sources", es: "Fuentes" },
  "tabs.components": { en: "Demand components", es: "Componentes de la demanda" },
  "tabs.intensity": { en: "Production vs water", es: "Producción vs agua" },

  "table.title": { en: "Top industrial sites (filtered)", es: "Principales sitios (filtrados)" },
  "table.hint": {
    en: "showing top 100 by water demand",
    es: "mostrando los 100 mayores por demanda de agua",
  },
  "table.industry": { en: "Industry", es: "Industria" },
  "table.category": { en: "Category", es: "Categoría" },
  "table.municipality": { en: "Municipality", es: "Municipio" },
  "table.state": { en: "State", es: "Estado" },
  "table.source": { en: "Source", es: "Fuente" },
  "table.area": { en: "Area m²", es: "Área m²" },
  "table.demand": { en: "Water demand m³/yr", es: "Demanda de agua m³/año" },
  "common.loading": { en: "Loading…", es: "Cargando…" },

  "chart.axis.demand": { en: "Water demand (hm³/yr)", es: "Demanda de agua (hm³/año)" },
  "chart.axis.category": { en: "Industry category", es: "Categoría industrial" },
  "chart.axis.state": { en: "State", es: "Estado" },
  "chart.axis.municipality": { en: "Municipality", es: "Municipio" },
  "chart.axis.production": {
    en: "Production value (USD million)",
    es: "Valor de producción (millones USD)",
  },
  "chart.tooltip.demand": { en: "Water demand", es: "Demanda de agua" },
  "chart.tooltip.sites": { en: "sites", es: "sitios" },
  "chart.series.production": { en: "Production", es: "Producción" },
  "chart.series.employees": { en: "Employees", es: "Empleados" },
  "chart.series.floor": { en: "Floor area", es: "Superficie" },
  "chart.scatter.intensity": {
    en: "Intensity: {v} m³ per USD million",
    es: "Intensidad: {v} m³ por millón USD",
  },

  "footer.iwmi": {
    en: "International Water Management Institute",
    es: "Instituto Internacional del Manejo del Agua",
  },
  "footer.rights": {
    en: "© 2026 IWMI · CONAGUA · Google.org. All rights reserved.",
    es: "© 2026 IWMI · CONAGUA · Google.org. Todos los derechos reservados.",
  },
} as const;

export type TKey = keyof typeof dict;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "lsw-lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "es") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback<Ctx["t"]>(
    (key, vars) => {
      let out: string = dict[key]?.[lang] ?? String(key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
      }
      return out;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
