import { useStore } from "@/lib/store";
import { ZonePlayer } from "./ZonePlayer";

export function PresentationPlayer({ presentationId }: { presentationId: string | null }) {
  const { presentations, media, layouts } = useStore();
  const pres = presentations.find((p) => p.id === presentationId);

  if (!pres) return <div className="h-full w-full flex items-center justify-center text-white/50 text-sm">Sem apresentação</div>;

  const layout = pres.layoutId ? layouts.find((l) => l.id === pres.layoutId) : null;
  const zones = layout?.zones ?? [{ key: "A", x: 0, y: 0, w: 100, h: 100 }];
  const isFullscreen = zones.length === 1;

  return (
    <div className="h-full w-full bg-black relative overflow-hidden">
      {zones.map((z) => {
        const binding = pres.zones?.[z.key];
        // Fullscreen / single-zone layout falls back to top-level mediaIds for compatibility
        const mediaIds = binding?.mediaIds?.length
          ? binding.mediaIds
          : (isFullscreen ? pres.mediaIds : []);
        const durationMs = binding?.durationMs ?? pres.durationMs;
        return (
          <div
            key={z.key}
            className="absolute"
            style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` }}
          >
            <ZonePlayer
              mediaIds={mediaIds}
              media={media}
              durationMs={durationMs}
              loop={pres.loop}
              transition={pres.transition}
              emptyLabel={`Zona ${z.key} vazia`}
            />
          </div>
        );
      })}
    </div>
  );
}