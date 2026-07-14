import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useMemo } from "react";
import { Upload, Trash2, Eye, Pencil, Check, X, Search, CheckSquare, Square, Clock } from "lucide-react";
import { useStore, addMedia, deleteMediaFromLibrary, renameMedia, deleteMediaBulk, setAutoDeleteEnabled, type Media } from "@/lib/store";
import { dialog } from "@/components/PremiumDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/app/library")({ component: Lib });

function Lib() {
  const { media, autoDeleteEnabled } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<Media | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = media.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  const allSelected = filtered.length > 0 && filtered.every((m) => selected.has(m.id));
  const someSelected = selected.size > 0;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(filtered.map((m) => m.id)));
  const clearAll = () => setSelected(new Set());

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const ok = await dialog.confirm({
      title: "Tem certeza que deseja apagar todos os itens selecionados?",
      description: `Esta ação é irreversível. ${ids.length} arquivo(s) serão removidos permanentemente.`,
      confirmLabel: "Apagar",
      cancelLabel: "Cancelar",
      destructive: true,
    });
    if (!ok) return;
    await deleteMediaBulk(ids);
    clearAll();
    toast.success(`${ids.length} item(ns) excluído(s)`);
  };

  const toggleAutoDelete = async (next: boolean) => {
    await setAutoDeleteEnabled(next);
    toast.success(next ? "Exclusão automática ativada (30 dias)" : "Exclusão automática desativada");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Biblioteca de Mídias</h1>
          <p className="text-sm text-muted-foreground">Tudo que você envia fica salvo aqui para reutilizar.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="rounded-md border bg-card pl-9 pr-3 py-2 text-sm w-64" />
          </div>
          <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4" className="hidden" onChange={(e) => e.target.files && addMedia(e.target.files)} />
          <button onClick={() => inputRef.current?.click()} className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
            <Upload className="h-4 w-4" /> Enviar
          </button>
        </div>
      </div>

      {/* Toolbar: bulk actions + auto-delete toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={allSelected ? clearAll : selectAll} disabled={filtered.length === 0} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50">
            {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {allSelected ? "Desmarcar todos" : "Selecionar todos"}
          </button>
          {someSelected && (
            <>
              <span className="text-xs text-muted-foreground">{selected.size} selecionado(s)</span>
              <button onClick={bulkDelete} className="flex items-center gap-2 rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90">
                <Trash2 className="h-4 w-4" /> Apagar todos os itens selecionados
              </button>
            </>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Apagar imagens e vídeos após 30 dias</span>
          <span className="relative inline-flex">
            <input type="checkbox" className="peer sr-only" checked={autoDeleteEnabled} onChange={(e) => toggleAutoDelete(e.target.checked)} />
            <span className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors" />
            <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-16 text-center text-muted-foreground">
          Nenhuma mídia encontrada. Clique em <strong>Enviar</strong> para adicionar imagens (PNG, JPG, WEBP) ou vídeos (MP4).
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((m) => {
            const isSel = selected.has(m.id);
            return (
            <div key={m.id} className={`group premium-border overflow-hidden ccp-anim-zoom relative ${isSel ? "ring-2 ring-primary" : ""}`}>
              {/* Selection checkbox */}
              <button onClick={() => toggle(m.id)} className={`absolute top-2 left-2 z-10 h-6 w-6 rounded-md flex items-center justify-center border-2 transition ${isSel ? "bg-primary border-primary text-primary-foreground" : "bg-black/50 border-white/40 text-transparent hover:border-white"}`}>
                <Check className="h-4 w-4" />
              </button>
              <div className="aspect-video bg-black flex items-center justify-center relative">
                {m.type === "image" ? (
                  <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  <video src={m.url} className="h-full w-full object-cover" muted />
                )}
                <button onClick={() => setPreview(m)} className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
                  <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100" />
                </button>
              </div>
              <div className="p-3 space-y-2">
                {editing === m.id ? (
                  <div className="flex gap-1">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 rounded border px-2 py-1 text-xs" />
                    <button onClick={() => { renameMedia(m.id, editName); setEditing(null); }} className="p-1 text-primary"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditing(null)} className="p-1"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate flex-1">{m.name}</p>
                    <button onClick={() => { setEditing(m.id); setEditName(m.name); }} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase text-muted-foreground">{m.type}</span>
                <button onClick={async () => { if (await dialog.confirm({ title: "Excluir mídia?", description: "Ela será removida de todas as apresentações vinculadas.", confirmLabel: "Excluir", destructive: true })) { await deleteMediaFromLibrary(m.id); toast.success("Mídia excluída"); } }} className="text-destructive hover:opacity-80">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-zoom-out">
          {preview.type === "image" ? (
            <img src={preview.url} alt={preview.name} className="max-h-full max-w-full object-contain" />
          ) : (
            <video src={preview.url} className="max-h-full max-w-full" controls autoPlay />
          )}
        </div>
      )}
    </div>
  );
}