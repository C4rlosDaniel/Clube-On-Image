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
  /** Force render even if the global `visibleAll` toggle is off (used in admin previews). */
  forceVisible?: boolean;
};

export function TickerBar({ terminalId, settingsOverride, messagesOverride, variant = "overlay", forceVisible = false }: Props) {
  const { tickerMessages, tickerSettings } = useStore();
  const settings: TickerSettings = { ...tickerSettings, ...(settingsOverride ?? {}) };
  const enabled = forceVisible || settings.visibleAll;

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
  const speed = Math.max(0.1, Number(settings.scrollSpeed) || 1);
  const baseSec = Math.max(20, Math.round(chain.length / 6));
  const durationSec = baseSec / speed;

  // Manual font size (12..24px) chosen globally by the user. No auto formula.
  // The user is responsible for increasing the bar height if the chosen size feels
  // too tight — the system no longer enforces the old 0.2cm padding rule.
  const autoFont = Math.max(12, Math.min(24, Math.round(settings.fontMax || 16)));
  const labelFont = Math.max(11, Math.min(24, Math.round(autoFont * 0.95)));

  const bg = hexWithOpacity(settings.bgColor, settings.bgOpacity);

  const positionClass = variant === "overlay"
    ? "absolute inset-x-0 bottom-0 z-40"
    : "relative w-full";

  return (
    <div
      className={`pointer-events-none ${positionClass} flex items-stretch ccp-ticker-shell`}
      style={{ height: `${settings.heightPx}px`, fontFamily: settings.fontFamily }}
    >
      {/* Label */}
      <div
        className="ccp-ticker-label flex items-center gap-2 font-bold uppercase tracking-widest text-white"
        style={{
          background: primary.color,
          fontSize: `${labelFont}px`,
          letterSpacing: "0.18em",
          padding: `0 18px`,
          border: "2px solid rgba(255,255,255,0.95)",
          borderRadius: 8,
        }}
      >
        {primary.priority && <AlertTriangle className="h-4 w-4 animate-pulse" />}
        <span className={primary.priority ? "animate-pulse" : ""}>{primary.label}</span>
      </div>
      {/* Scrolling track */}
      <div
        className="ccp-ticker-track-wrap relative flex-1 overflow-hidden text-black backdrop-blur-sm"
        style={{ background: bg, border: "2px solid #dc2626", borderRadius: 8 }}
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