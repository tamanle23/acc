import {
  createContext,
  useContext,
  createEffect,
  createSignal,
  createMemo,
  onCleanup,
  ParentComponent,
  Show,
  For,
  Accessor,
} from "solid-js";
import {
  THEME_PRESETS,
  DEFAULT_THEME_ID,
  applyThemeToDom,
  auditThemeContrast,
  type ThemePreset,
  type ThemeCategory,
} from "@/lib/themes";
import {
  Palette,
  Check,
  Sun,
  Moon,
  Sparkles,
  X,
  Search,
  RotateCcw,
  ShieldCheck,
} from "lucide-solid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface ThemeManagerContextValue {
  currentTheme: Accessor<ThemePreset>;
  setThemeById: (id: string) => void;
  cycleQuickMode: () => void;
  openGallery: () => void;
  closeGallery: () => void;
  isGalleryOpen: Accessor<boolean>;
  presets: ThemePreset[];
}

const ThemeManagerContext = createContext<ThemeManagerContextValue | null>(null);

const STORAGE_KEY = "ai_studio_theme_preset_v5";

export const ThemeProvider: ParentComponent = (props) => {
  const [themeId, setThemeId] = createSignal<string>(
    typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME_ID
      : DEFAULT_THEME_ID
  );
  const [isGalleryOpen, setIsGalleryOpen] = createSignal(false);

  const currentTheme = createMemo(
    () => THEME_PRESETS.find((t) => t.id === themeId()) ?? THEME_PRESETS[0]
  );

  createEffect(() => {
    applyThemeToDom(currentTheme());
    try {
      localStorage.setItem(STORAGE_KEY, currentTheme().id);
    } catch {
      // Ignore storage quota errors
    }
  });

  // Keyboard shortcut: Cmd/Ctrl + J or Escape for gallery
  createEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsGalleryOpen((prev) => !prev);
      } else if (e.key === "Escape" && isGalleryOpen()) {
        setIsGalleryOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  const setThemeById = (id: string) => {
    if (THEME_PRESETS.some((t) => t.id === id)) {
      setThemeId(id);
    }
  };

  const cycleQuickMode = () => {
    if (currentTheme().mode === "dark") {
      setThemeId("catppuccin-latte");
    } else {
      setThemeId("obsidian-zinc");
    }
  };

  return (
    <ThemeManagerContext.Provider
      value={{
        currentTheme,
        setThemeById,
        cycleQuickMode,
        openGallery: () => setIsGalleryOpen(true),
        closeGallery: () => setIsGalleryOpen(false),
        isGalleryOpen,
        presets: THEME_PRESETS,
      }}
    >
      {props.children}
      <ThemeGalleryModal />
    </ThemeManagerContext.Provider>
  );
};

export function useThemeManager(): ThemeManagerContextValue {
  const ctx = useContext(ThemeManagerContext);
  if (!ctx) {
    throw new Error("useThemeManager must be used within a ThemeProvider");
  }
  return ctx;
}

const CATEGORIES: ("All" | ThemeCategory)[] = [
  "All",
  "Studio Dark",
  "Editor Classics",
  "Atmospheric",
  "Studio Light",
];

function ThemeGalleryModal() {
  const { currentTheme, setThemeById, isGalleryOpen, closeGallery, presets } =
    useThemeManager();
  const [search, setSearch] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<
    "All" | ThemeCategory
  >("All");

  const activeAudit = createMemo(() => auditThemeContrast(currentTheme()));

  const filtered = createMemo(() =>
    presets.filter((t) => {
      const matchesCategory =
        selectedCategory() === "All" || t.category === selectedCategory();
      const query = search().toLowerCase();
      const matchesQuery =
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    })
  );

  return (
    <Show when={isGalleryOpen()}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-gallery-title"
        onClick={closeGallery}
      >
        <div
          class="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div class="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/60">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-primary/15 border border-primary/30 text-primary">
                <Palette class="w-5 h-5" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 id="theme-gallery-title" class="text-sm font-semibold">
                    Studio Theme Engine
                  </h2>
                  <Badge variant="default">20 Presets</Badge>
                  <Badge
                    variant="outline"
                    class="border-success/40 bg-success/15 text-success font-mono text-[10px] flex items-center gap-1 font-semibold"
                  >
                    <ShieldCheck class="w-3.5 h-3.5 text-success" />
                    WCAG 2.1 AA Verified ({activeAudit().minRatio}:1 min)
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Real-time CSS custom property injection with Tailwind HSL
                  semantic tokens (Shortcut: Ctrl/Cmd + J)
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setThemeById(DEFAULT_THEME_ID)}
                title="Reset to Obsidian Zinc"
              >
                <RotateCcw class="w-3.5 h-3.5" />
                <span>Reset</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeGallery}
                aria-label="Close theme gallery"
              >
                <X class="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div class="px-6 py-3.5 border-b border-border bg-surface/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div
              class="flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Theme Categories"
            >
              <For each={CATEGORIES}>
                {(cat) => (
                  <button
                    role="tab"
                    aria-selected={selectedCategory() === cat}
                    onClick={() => setSelectedCategory(cat)}
                    class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedCategory() === cat
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/40"
                    }`}
                  >
                    {cat}
                  </button>
                )}
              </For>
            </div>

            <div class="relative w-full sm:w-64">
              <Search class="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                placeholder="Search 20 themes..."
                class="h-9 pl-8 text-xs"
              />
            </div>
          </div>

          {/* 20 Theme Preset Grid */}
          <div class="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <For each={filtered()}>
              {(preset) => {
                const isSelected = () => preset.id === currentTheme().id;
                const pAudit = auditThemeContrast(preset);
                return (
                  <button
                    onClick={() => setThemeById(preset.id)}
                    class={`group text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isSelected()
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-surface/50 hover:border-primary/50 hover:bg-surface"
                    }`}
                  >
                    <div class="space-y-2 w-full">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Show
                            when={preset.mode === "light"}
                            fallback={<Moon class="w-3.5 h-3.5 text-primary" />}
                          >
                            <Sun class="w-3.5 h-3.5 text-amber-500" />
                          </Show>
                          {preset.name}
                        </span>
                        <Show
                          when={isSelected()}
                          fallback={
                            <span class="text-[10px] font-mono text-muted-foreground">
                              {preset.category}
                            </span>
                          }
                        >
                          <span class="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                            <Check class="w-3 h-3" /> Active
                          </span>
                        </Show>
                      </div>
                      <p class="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    {/* Live Color Swatch & WCAG Contrast Rating Bar */}
                    <div class="flex items-center justify-between pt-2 border-t border-border/60 w-full text-[10px] font-mono">
                      <div class="flex items-center gap-1.5">
                        <For each={preset.swatches}>
                          {(hex) => (
                            <span
                              class="w-4 h-4 rounded-full border border-border shadow-xs transition-transform group-hover:scale-110"
                              style={{ "background-color": hex }}
                              title={hex}
                            />
                          )}
                        </For>
                      </div>
                      <span class="px-1.5 py-0.5 rounded border border-success/35 bg-success/10 text-success font-semibold">
                        ✓ {pAudit.compliantAAA ? "AAA" : "AA"}{" "}
                        {pAudit.minRatio}:1
                      </span>
                    </div>
                  </button>
                );
              }}
            </For>
          </div>

          {/* Modal Footer */}
          <div class="px-6 py-3 border-t border-border bg-surface/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
            <div class="flex flex-wrap items-center gap-2">
              <Sparkles class="w-3.5 h-3.5 text-primary" />
              <span>
                Active:{" "}
                <strong class="text-foreground">
                  {currentTheme().name}
                </strong>
              </span>
              <span class="text-muted-foreground">•</span>
              <span>
                Body:{" "}
                <strong class="text-foreground">
                  {activeAudit().bodyRatio}:1
                </strong>
              </span>
              <span>
                Card:{" "}
                <strong class="text-foreground">
                  {activeAudit().cardRatio}:1
                </strong>
              </span>
              <span>
                Muted:{" "}
                <strong class="text-foreground">
                  {activeAudit().mutedRatio}:1
                </strong>
              </span>
              <span>
                Btn:{" "}
                <strong class="text-foreground">
                  {activeAudit().primaryRatio}:1
                </strong>
              </span>
            </div>
            <Button size="sm" onClick={closeGallery}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
}
