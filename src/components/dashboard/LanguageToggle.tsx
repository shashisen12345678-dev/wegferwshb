import { useI18n } from "@/lib/i18n";

/** Sliding two-state language switch (English / Español). */
export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className="relative flex items-center rounded-full border border-white/20 bg-white/10 p-0.5 backdrop-blur-sm"
    >
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: lang === "es" ? "translateX(100%)" : "translateX(0)" }}
      />
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`relative z-10 w-14 rounded-full px-2 py-1 text-[11px] font-semibold tracking-wide uppercase transition-colors ${
            lang === l ? "text-header" : "text-header-foreground/80 hover:text-header-foreground"
          }`}
        >
          {l === "en" ? "EN" : "ES"}
        </button>
      ))}
    </div>
  );
}
