import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, resolveZone, type Media, type Presentation, type SplitLayout, type SplitZone } from "@/lib/store";

/**
 * Plays a single zone playlist. Each zone owns its own timer, so Zone 1 and
 * Zone 2 advance completely independently of one another.
 */
export function ZonePlayer({ zone, media, presentations, className = "" }: {
  zone: SplitZone;
  media: Media[];
  presentations: Presentation[];
  className?: string;
}) {
  const resolved = useMemo(() => resolveZone(zone, presentations), [zone, presentations]);
  const items = useMemo(
    () => resolved.mediaIds.map((id) => media.find((m) => m.id === id)).filter(Boolean) as Media[],
    [resolved.mediaIds, media]
  );
  const [idx, setIdx] = useState(0);
  const timer = useRef<number | null>(null);
  const key = resolved.mediaIds.join(",");

  useEffect(() => { setIdx(0); }, [key]);

  const cur = items.length ? items[idx % items.length] : null;

  useEffect(() => {
    if (!cur || cur.type !== "image" || items.length === 0) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => setIdx((i) => (i + 1) % items.length),
      Math.max(3000, resolved.durationMs)
    );
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [cur?.id, idx, items.length, resolved.durationMs]);

  if (!cur) {
    return <div className={`h-full w-full bg-black flex items-center justify-center text-[10px] uppercase tracking-widest text-white/40 ${className}`}>Zona vazia</div>;
  }

  const fit: "contain" | "cover" = zone.letterbox ? "contain" : "cover";
  const anim = resolved.transition === "cut" ? "" : "ccp-anim-fade";
  const bg =
    !zone.letterbox ? "#000" :
    zone.fillStyle === "red" ? "#EC1C24" :
    zone.fillStyle === "white" ? "#ffffff" : "#000";

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} style={{ background: bg }}>
      {zone.letterbox && zone.fillStyle === "blur" && cur.type === "image" && (
        <img
          src={cur.url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-60"
        />
      )}
      {cur.type === "image" ? (
        <img
          key={cur.id + ":" + idx}
          src={cur.url}
          alt=""
          className={`absolute inset-0 ${anim}`}
          style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: "center" }}
        />
      ) : (
        <video
          key={cur.id + ":" + idx}
          src={cur.url}
          className={`absolute inset-0 ${anim}`}
          style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: "center" }}
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => setIdx((i) => (i + 1) % items.length)}
        />
      )}
    </div>
  );
}

/** Renders a full SplitScreen layout (2 independent zones). */
export function SplitScreenPlayer({ layout }: { layout: SplitLayout }) {
  const { media, presentations } = useStore();
  const pct = Math.max(15, Math.min(50, layout.zone2Pct));
  const vertical = layout.orientation === "vertical_direita";

  return (
    <div className={`h-full w-full bg-black flex ${vertical ? "flex-row" : "flex-col"}`}>
      <div className="min-h-0 min-w-0" style={vertical ? { width: `${100 - pct}%`, height: "100%" } : { height: `${100 - pct}%`, width: "100%" }}>
        <ZonePlayer zone={layout.zone1} media={media} presentations={presentations} />
      </div>
      <div className="min-h-0 min-w-0" style={vertical ? { width: `${pct}%`, height: "100%" } : { height: `${pct}%`, width: "100%" }}>
        <ZonePlayer zone={layout.zone2} media={media} presentations={presentations} />
      </div>
    </div>
  );
}