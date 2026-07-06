import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useStore, type TickerMessage, type TickerSettings } from "@/lib/store";

type Props = {
  terminalId?: string | null;
  /** Override global settings (used in live preview). */
  settingsOverride?: Partial<TickerSettings>;
  /** Override messages (used in live preview). */
  messagesOverride?: TickerMessage[];
  /**
   * Layout mode:
   * - "overlay" (default): absolute at bottom, floats above content.
   * - "inline": renders inline block that reserves vertical space so content isn't covered.
   */
  variant?: "overlay" | "inline";
};

export function TickerBar({ terminalId, settingsOverride, messagesOverride, variant = "overlay" }: Props) {
  const { tickerMessages, terminals, tickerSettings } = useStore();
  const terminal = terminalId ? terminals.find((t) => t.id === terminalId) : null;
  const enabled = terminal ? terminal.showTicker : true;
  const settings: TickerSettings = { ...tickerSettings, ...(settingsOverride ?? {}) };

  const active = useMemo(() => {
    const src = messagesOverride ?? tickerMessages;
    const now = Date.now();
    const list = src
      .filter((m) => m.active)
      .filter((m) => (m.startsAt == null || m.startsAt <= now))
      .filter((m) => (m.endsAt == null || m.endsAt >= now))
      .filter((m) => !terminalId || m.terminalIds.length === 0 || m.terminalIds.includes(terminalId))
      .sort((a, b) => (Number(b.priority) - Number(a.priority)) || (a.orderIndex - b.orderIndex));
    return list;
  }, [tickerMessages, messagesOverride, terminalId]);

  if (!enabled || active.length === 0) return null;

  const urgent = active.find((m) => m.priority);
  const primary = urgent ?? active[0];

  // Strip html for speed estimation
  const stripHtml = (h: string) => h.replace(/<[^>]*>/g, "");
  const chain = active.map((m) => stripHtml(m.text)).join("     •     ");
  const durationSec = Math.max(20, Math.round(chain.length / 6));

  // Auto-sized font: clamp based on ticker height, respecting 0.2cm (~7.5px)
  // padding on top/bottom, never exceeding the configured max (default 24).
  const availableTextHeight = Math.max(12, settings.heightPx - 16);
  const autoFont = Math.max(settings.fontMin, Math.min(settings.fontMax, Math.round(availableTextHeight * 0.42)));
  const labelFont = Math.max(11, Math.min(settings.fontMax - 2, Math.round(autoFont * 0.85)));

  const bg = hexWithOpacity(settings.bgColor, settings.bgOpacity);

  const positionClass = variant === "overlay"
    ? "absolute inset-x-0 bottom-0 z-40"
    : "relative w-full";

  return (
    <div
      className={`pointer-events-none ${positionClass} flex items-stretch`}
      style={{ height: `${settings.heightPx}px`, fontFamily: settings.fontFamily }}
    >
      {/* Label */}
      <div
        className="flex items-center gap-2 font-bold uppercase tracking-widest text-white shadow-lg"
        style={{
          background: primary.color,
          fontSize: `${labelFont}px`,
          letterSpacing: "0.18em",
          padding: `0 max(16px, 0.2cm) 0 max(16px, 0.2cm)`,
        }}
      >
        {primary.priority && <AlertTriangle className="h-4 w-4 animate-pulse" />}
        <span className={primary.priority ? "animate-pulse" : ""}>{primary.label}</span>
      </div>
      {/* Scrolling track */}
      <div
        className="relative flex-1 overflow-hidden text-black backdrop-blur-sm border-t border-black/10"
        style={{ background: bg, paddingTop: "0.2cm", paddingBottom: "0.2cm" }}
      >
        <div
          className="ccp-ticker-track flex items-center h-full whitespace-nowrap font-medium will-change-transform"
          style={{
            animationDuration: `${durationSec}s`,
            fontSize: `${autoFont}px`,
            fontFamily: settings.fontFamily,
          }}
        >
          <TickerContent messages={active} />
          <TickerContent messages={active} />
        </div>
      </div>
    </div>
  );
}

function hexWithOpacity(hex: string, opacity: number): string {
  const clean = hex.replace("#", "");
  const isShort = clean.length === 3;
  const r = parseInt(isShort ? clean[0] + clean[0] : clean.slice(0, 2), 16);
  const g = parseInt(isShort ? clean[1] + clean[1] : clean.slice(2, 4), 16);
  const b = parseInt(isShort ? clean[2] + clean[2] : clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function TickerContent({ messages }: { messages: TickerMessage[] }) {
  return (
    <div className="flex items-center px-6 shrink-0">
      {messages.map((m, i) => (
        <span key={`${m.id}-${i}`} className="flex items-center">
          {m.priority && (
            <span
              className="mr-3 rounded px-2 py-0.5 text-[0.7em] font-bold uppercase text-white"
              style={{ background: m.color }}
            >
              URGENTE
            </span>
          )}
          <span className="px-1" dangerouslySetInnerHTML={{ __html: m.text }} />
          <span className="mx-6 text-black/30">•</span>
        </span>
      ))}
    </div>
  );
}