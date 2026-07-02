import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useStore, type TickerMessage } from "@/lib/store";

export function TickerBar({ terminalId }: { terminalId?: string | null }) {
  const { tickerMessages, terminals } = useStore();
  const terminal = terminalId ? terminals.find((t) => t.id === terminalId) : null;
  const enabled = terminal ? terminal.showTicker : true;

  const active = useMemo(() => {
    const now = Date.now();
    const list = tickerMessages
      .filter((m) => m.active)
      .filter((m) => (m.startsAt == null || m.startsAt <= now))
      .filter((m) => (m.endsAt == null || m.endsAt >= now))
      .filter((m) => !terminalId || m.terminalIds.length === 0 || m.terminalIds.includes(terminalId))
      .sort((a, b) => (Number(b.priority) - Number(a.priority)) || (a.orderIndex - b.orderIndex));
    return list;
  }, [tickerMessages, terminalId]);

  if (!enabled || active.length === 0) return null;

  const urgent = active.find((m) => m.priority);
  const primary = urgent ?? active[0];

  // Build a long, seamless string by joining messages
  const chain = active.map((m) => m.text).join("     •     ");
  // Speed: pixels per second scales with length
  const durationSec = Math.max(20, Math.round(chain.length / 6));

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex items-stretch"
      style={{ height: "clamp(44px, 6.5vh, 84px)" }}
    >
      {/* Label */}
      <div
        className="flex items-center gap-2 px-4 md:px-6 font-bold uppercase tracking-widest text-white shadow-lg"
        style={{
          background: primary.color,
          fontSize: "clamp(11px, 1.4vh, 18px)",
          letterSpacing: "0.18em",
        }}
      >
        {primary.priority && <AlertTriangle className="h-4 w-4 animate-pulse" />}
        <span className={primary.priority ? "animate-pulse" : ""}>{primary.label}</span>
      </div>
      {/* Scrolling track */}
      <div className="relative flex-1 overflow-hidden bg-white/95 text-black backdrop-blur-sm border-t border-black/10">
        <div
          className="ccp-ticker-track flex items-center h-full whitespace-nowrap font-medium will-change-transform"
          style={{
            animationDuration: `${durationSec}s`,
            fontSize: "clamp(12px, 1.8vh, 22px)",
          }}
        >
          <TickerContent messages={active} />
          <TickerContent messages={active} />
        </div>
      </div>
    </div>
  );
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
          <span className="px-1">{m.text}</span>
          <span className="mx-6 text-black/30">•</span>
        </span>
      ))}
    </div>
  );
}