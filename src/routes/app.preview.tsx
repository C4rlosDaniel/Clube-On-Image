import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { useStore } from "@/lib/store";
import { PresentationPlayer } from "@/components/PresentationPlayer";

export const Route = createFileRoute("/app/preview")({ component: Prev });

function Prev() {
  const store = useStore();
  const { presentations, terminals, media } = store;
  const [presId, setPresId] = useState<string>(presentations[0]?.id ?? "");
  const [orient, setOrient] = useState<"h" | "v">("h");
  const pres = presentations.find((p) => p.id === presId);

  return (
    <div className="space-y-5">
      <div className="flex justify-between flex-wrap gap-3 items-end">
        <div>
          <h1 className="text-2xl font-bold">Preview em Tempo Real</h1>
          <p className="text-sm text-muted-foreground">Simulação de TV horizontal e vertical. Atualiza instantaneamente.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={presId} onChange={(e) => setPresId(e.target.value)} className="rounded border bg-background px-3 py-2 text-sm">
            <option value="">Selecionar apresentação</option>
            {presentations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex rounded-md border overflow-hidden">
            <button onClick={() => setOrient("h")} className={`px-3 py-2 text-sm ${orient === "h" ? "bg-primary text-primary-foreground" : ""}`}><Monitor className="h-4 w-4" /></button>
            <button onClick={() => setOrient("v")} className={`px-3 py-2 text-sm ${orient === "v" ? "bg-primary text-primary-foreground" : ""}`}><Smartphone className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {pres ? (
        <div className="flex justify-center ccp-anim-zoom">
          <div className={`premium-border-gradient bg-black shadow-2xl overflow-hidden ${orient === "h" ? "w-full max-w-4xl aspect-video" : "h-[70vh] aspect-[9/16]"}`}>
            <PresentationPlayer presentationId={presId} />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground">Crie uma apresentação na aba Apresentações para visualizar aqui.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Apresentações" value={presentations.length} />
        <Stat label="Terminais ativos" value={terminals.filter((t) => t.active).length} />
        <Stat label="Mídias" value={media.length} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="premium-border p-4 ccp-anim-fade">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}