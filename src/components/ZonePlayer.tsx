import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Media, Presentation } from "@/lib/store";

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (!url) return resolve();
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

function preloadVideo(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (!url) return resolve();
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    const done = () => resolve();
    v.oncanplaythrough = done;
    v.onloadeddata = done;
    v.onerror = done;
    v.src = url;
    setTimeout(done, 8000);
  });
}

function preloadMedia(m: Media | undefined): Promise<void> {
  if (!m) return Promise.resolve();
  return m.type === "image" ? preloadImage(m.url) : preloadVideo(m.url);
}

export type ZonePlayerProps = {
  mediaIds: string[];
  media: Media[];
  durationMs: number;
  loop: boolean;
  transition?: Presentation["transition"];
  emptyLabel?: string;
};

export function ZonePlayer({ mediaIds, media, durationMs, loop, transition = "fade", emptyLabel = "Zona vazia" }: ZonePlayerProps) {
  const items = useMemo(
    () => (mediaIds.map((id) => media.find((m) => m.id === id)).filter(Boolean) as Media[]),
    [mediaIds, media]
  );

  const [idx, setIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const [booted, setBooted] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIdx(0);
    setReady(false);
    setBooted(false);
    if (items.length === 0) return;
    (async () => {
      await preloadMedia(items[0]);
      if (cancelled) return;
      setBooted(true);
      setReady(true);
      if (items[1]) preloadMedia(items[1]);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaIds.join("|")]);

  useEffect(() => {
    if (items.length === 0 || !booted) return;
    const cur = items[idx % items.length];
    if (!cur) return;
    const nextIdx = (idx + 1) % items.length;
    preloadMedia(items[nextIdx]);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (cur.type === "image") {
      timerRef.current = window.setTimeout(async () => {
        await preloadMedia(items[nextIdx]);
        setIdx((i) => (loop ? (i + 1) % items.length : Math.min(i + 1, items.length - 1)));
      }, durationMs);
    }
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [idx, items, durationMs, loop, booted]);

  if (items.length === 0) {
    return <div className="h-full w-full flex items-center justify-center text-white/40 text-xs bg-black">{emptyLabel}</div>;
  }

  const cur = items[idx % items.length];
  const animClass =
    transition === "zoom" ? "ccp-anim-zoom" :
    transition === "slide" ? "ccp-anim-slide" :
    transition === "push" ? "ccp-anim-push" :
    "ccp-anim-fade";

  return (
    <div className="h-full w-full bg-black relative overflow-hidden">
      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <Loader2 className="h-6 w-6 animate-spin text-white/70" />
        </div>
      )}
      {booted && (
        cur.type === "image" ? (
          <img
            key={cur.id + ":" + idx}
            src={cur.url}
            alt=""
            className={`absolute inset-0 h-full w-full object-contain ${animClass}`}
            onLoad={() => setReady(true)}
          />
        ) : (
          <video
            key={cur.id + ":" + idx}
            src={cur.url}
            className={`absolute inset-0 h-full w-full object-contain ${animClass}`}
            autoPlay
            muted
            playsInline
            preload="auto"
            onCanPlay={() => setReady(true)}
            onEnded={async () => {
              const nextIdx = (idx + 1) % items.length;
              await preloadMedia(items[nextIdx]);
              setIdx((i) => (loop ? (i + 1) % items.length : Math.min(i + 1, items.length - 1)));
            }}
          />
        )
      )}
    </div>
  );
}