import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type Props = {
  label: string;
  options: string[];
  selected: number[];
  onChange: (v: number[]) => void;
  colors?: (i: number) => string;
};

export function MultiSelect({ label, options, selected, onChange, colors }: Props) {
  const [q, setQ] = useState("");
  const { t } = useI18n();
  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => o.toLowerCase().includes(needle))
      .slice(0, 400);
  }, [options, q]);

  const toggle = (i: number) =>
    onChange(selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 w-full justify-between border-border bg-card font-normal"
        >
          <span className="truncate">
            {label}
            {selected.length > 0 && (
              <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                {selected.length}
              </span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center gap-2 border-b border-border p-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`${t("select.search")} ${label.toLowerCase()}…`}
            className="h-8"
          />
          {selected.length > 0 && (
            <Button variant="ghost" size="icon" className="size-8" onClick={() => onChange([])}>
              <X className="size-4" />
            </Button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.map(({ o, i }) => {
            const active = selected.includes(i);
            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                  active && "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border border-border",
                    active && "bg-primary text-primary-foreground",
                  )}
                >
                  {active && <Check className="size-3" />}
                </span>
                {colors && (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colors(i) }}
                  />
                )}
                <span className="truncate">{o}</span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              {t("select.noMatches")}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}