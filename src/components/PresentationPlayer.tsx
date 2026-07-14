import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useStore, type Media } from "@/lib/store";

// Preload an image fully into the browser cache
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (!url) return resolve();
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

// Preload a video until it has enough data to play through
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
    // Safety timeout — never block forever
    setTimeout(done, 8000);
  });
}

function preloadMedia(m: Media | undefined): Promise<void> {
  if (!m) return Promise.resolve();
  return m.type === "image" ? preloadImage(m.url) : preloadVideo(m.url);
}

export function PresentationPlayer({ presentationId }: { presentationId: string | null }) {
  const { presentations, media } = useStore();
  const pres = presentations.find((p) => p.id === presentationId);

  const items = useMemo(
    () => ((pres?.mediaIds ?? [])
      .map((id) => media.find((m) => m.id === id))
      .filter(Boolean) as Media[]),
    [pres?.mediaIds, media]
  );

  const [idx, setIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const [booted, setBooted] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Reset when presentation changes; preload first item before showing
  useEffect(() => {
    let cancelled = false;
    setIdx(0);
    setReady(false);
    setBooted(false);
    if (!pres || items.length === 0) return;
    (async () => {
      // Preload first item fully; warm next item in parallel
      await preloadMedia(items[0]);
      if (cancelled) return;
      setBooted(true);
      setReady(true);
      // Warm next
      if (items[1]) preloadMedia(items[1]);
    })();
    return () => { cancelled = true; };
  }, [presentationId, items.length]);

  // Advance for images on timer; preload upcoming item
  useEffect(() => {
    if (!pres || items.length === 0 || !booted) return;
    const cur = items[idx % items.length];
    if (!cur) return;
    const nextIdx = (idx + 1) % items.length;
    // Pre-warm next while current plays
    preloadMedia(items[nextIdx]);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (cur.type === "image") {
      timerRef.current = window.setTimeout(async () => {
        // Ensure next is ready before swap to avoid black frame
        await preloadMedia(items[nextIdx]);
        setIdx((i) => (pres.loop ? (i + 1) % items.length : Math.min(i + 1, items.length - 1)));
      }, pres.durationMs);
    }
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [idx, items, pres, booted]);

  if (!pres) return <div className="h-full w-full flex items-center justify-center text-white/50 text-sm">Sem apresentação</div>;
  if (items.length === 0) return <div className="h-full w-full flex items-center justify-center text-white/50 text-sm">Apresentação vazia</div>;

  const cur = items[idx % items.length];
  const transition = pres.transition ?? "fade";
  const animClass =
    transition === "zoom" ? "ccp-anim-zoom" :
    transition === "slide" ? "ccp-anim-slide" :
    transition === "push" ? "ccp-anim-push" :
    "ccp-anim-fade";

  return (
    <div className="h-full w-full bg-black relative overflow-hidden">
      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3 text-white/70">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-xs uppercase tracking-widest">Preparando apresentação…</p>
          </div>
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
              setIdx((i) => (pres.loop ? (i + 1) % items.length : Math.min(i + 1, items.length - 1)));
            }}
          />
        )
      )}
    </div>
  );
}