import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Eye, Pencil, Check, X, Upload, Image as ImageIcon, Film, ChevronRight, Save, Loader2 } from "lucide-react";
import { useStore, createPresentation, updatePresentation, deletePresentation, addMedia, type Media, type Presentation, type Layout, type ZoneBinding } from "@/lib/store";
import { dialog } from "@/components/PremiumDialog";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/RichTextEditor";

export const Route = createFileRoute("/app/presentations")({ component: Pres });

function Pres() {
  const { presentations, media, layouts } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(presentations[0]?.id ?? null);
  const selected = presentations.find((p) => p.id === selectedId) ?? null;

  const handleCreate = async () => {
    const name = await dialog.prompt({
      title: "Nova Apresentação",
      description: "Dê um nome para identificar essa playlist nas atribuições.",
      placeholder: "Ex: Vitrine Principal",
      confirmLabel: "Criar",
    });
    if (name) {
      const id = await createPresentation(name);
      if (id) { setSelectedId(id); toast.success("Apresentação criada"); }
      else toast.error("Falha ao criar apresentação");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 ccp-anim-fade">
      <aside className="space-y-2 premium-border p-3">
        <button onClick={handleCreate} className="w-full flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Nova Apresentação
        </button>
        <div className="space-y-1">
          {presentations.map((p) => (
            <button key={p.id} onClick={() => setSelectedId(p.id)} className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${selectedId === p.id ? "ccp-tab-active" : "hover:bg-accent/50"}`}>
              <span className="truncate">{p.name}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">{p.mediaIds.length} <ChevronRight className="h-3 w-3" /></span>
            </button>
          ))}
          {!presentations.length && <p className="text-sm text-muted-foreground p-4 text-center">Nenhuma apresentação ainda.</p>}
        </div>
      </aside>
      <section>
        {selected ? <Editor key={selected.id} pres={selected} media={media} layouts={layouts} /> : <div className="premium-border p-16 text-center text-muted-foreground">Selecione ou crie uma apresentação.</div>}
      </section>
    </div>
  );
}

function Editor({ pres, media, layouts }: { pres: Presentation; media: Media[]; layouts: Layout[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(pres.name);
  const [showLib, setShowLib] = useState(false);
  const [preview, setPreview] = useState<Media | null>(null);
  const [draft, setDraft] = useState<Presentation>(pres);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setDraft(pres); setName(pres.name); }, [pres.id]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(pres);

  const items = draft.mediaIds.map((id) => media.find((m) => m.id === id)).filter(Boolean) as Media[];

  const currentLayout = draft.layoutId ? layouts.find((l) => l.id === draft.layoutId) ?? null : null;
  const isMultiZone = !!currentLayout && currentLayout.zones.length > 1;

  const changeLayout = (layoutId: string | "") => {
    const nextLayout = layoutId ? layouts.find((l) => l.id === layoutId) ?? null : null;
    setDraft((d) => {
      // Preserve bindings only for zones still present in the new layout (safe redistribute)
      const keep: Record<string, ZoneBinding> = {};
      const validKeys = new Set((nextLayout?.zones ?? []).map((z) => z.key));
      Object.entries(d.zones ?? {}).forEach(([k, v]) => { if (validKeys.has(k)) keep[k] = v; });
      // If moving from fullscreen (no layout) to multi-zone, seed Zone A with the existing mediaIds
      if (!d.layoutId && nextLayout && nextLayout.zones.length > 1 && !keep["A"] && d.mediaIds.length) {
        keep["A"] = { mediaIds: [...d.mediaIds], durationMs: d.durationMs };
      }
      return { ...d, layoutId: nextLayout?.id ?? null, zones: keep };
    });
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const added = await addMedia(files);
      setDraft((d) => ({ ...d, mediaIds: [...d.mediaIds, ...added.map((a) => a.id)] }));
      toast.success(`${added.length} mídia(s) enviada(s)`);
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePresentation(pres.id, {
        name: draft.name,
        mediaIds: draft.mediaIds,
        durationMs: draft.durationMs,
        loop: draft.loop,
        description: draft.description,
        transition: draft.transition,
        layoutId: draft.layoutId ?? null,
        zones: draft.zones ?? {},
      });
      toast.success("Apresentação salva e sincronizada");
    } catch (e) {
      toast.error("Falha ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 ccp-anim-slide">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {editingName ? (
          <div className="flex gap-2 items-center">
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border px-3 py-2 text-lg font-bold" />
            <button onClick={() => { setDraft((d) => ({ ...d, name })); setEditingName(false); }} className="p-2 text-primary"><Check className="h-5 w-5" /></button>
            <button onClick={() => { setName(pres.name); setEditingName(false); }} className="p-2"><X className="h-5 w-5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{draft.name}</h2>
            <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
            {dirty && <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">alterações pendentes</span>}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-muted-foreground">Duração (s):</label>
          <input type="number" min={1} value={draft.durationMs / 1000} onChange={(e) => setDraft((d) => ({ ...d, durationMs: Math.max(1, Number(e.target.value)) * 1000 }))} className="w-20 rounded border px-2 py-1 text-sm" />
          <label className="flex items-center gap-1 text-xs ml-3">
            <input type="checkbox" checked={draft.loop} onChange={(e) => setDraft((d) => ({ ...d, loop: e.target.checked }))} /> Loop
          </label>
          <label className="text-xs text-muted-foreground ml-3">Transição:</label>
          <select
            value={draft.transition ?? "fade"}
            onChange={(e) => setDraft((d) => ({ ...d, transition: e.target.value as Presentation["transition"] }))}
            className="rounded border bg-background px-2 py-1 text-xs"
          >
            <option value="fade">Fade</option>
            <option value="zoom">Zoom</option>
            <option value="slide">Slide</option>
            <option value="push">Push</option>
          </select>
          <label className="text-xs text-muted-foreground ml-3">Layout:</label>
          <select
            value={draft.layoutId ?? ""}
            onChange={(e) => changeLayout(e.target.value)}
            className="rounded border bg-background px-2 py-1 text-xs"
          >
            <option value="">Tela cheia (padrão)</option>
            {layouts.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="ml-3 flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-lg shadow-primary/30 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar Apresentação"}
          </button>
          <button onClick={async () => { if (await dialog.confirm({ title: "Excluir apresentação?", description: "Esta ação não pode ser desfeita.", confirmLabel: "Excluir", destructive: true })) { await deletePresentation(pres.id); toast.success("Apresentação excluída"); } }} className="ml-1 text-destructive flex items-center gap-1 text-sm"><Trash2 className="h-4 w-4" /> Excluir</button>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Descrição / Anotações</p>
        <RichTextEditor
          value={draft.description ?? ""}
          onChange={(html) => setDraft((d) => ({ ...d, description: html }))}
          placeholder="Adicione descrição, instruções, observações..."
        />
      </div>

      {!isMultiZone && (<>
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="file" multiple accept="image/*,video/mp4" className="hidden" onChange={(e) => onUpload(e.target.files)} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {uploading ? "Enviando..." : "Upload"}
        </button>
        <button onClick={() => setShowLib((v) => !v)} className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium">{showLib ? "Ocultar" : "Adicionar da"} Biblioteca</button>
      </div>

      {showLib && (
        <div className="rounded-lg border p-4 bg-card">
          <p className="text-sm font-medium mb-3">Clique para adicionar à apresentação</p>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {media.map((m) => {
              const added = draft.mediaIds.includes(m.id);
              return (
                <button key={m.id} onClick={() => setDraft((d) => ({ ...d, mediaIds: added ? d.mediaIds.filter((x) => x !== m.id) : [...d.mediaIds, m.id] }))} className={`relative aspect-video overflow-hidden rounded border-2 ${added ? "border-primary" : "border-transparent"}`}>
                  {m.type === "image" ? <img src={m.url} alt="" className="w-full h-full object-cover" /> : <video src={m.url} className="w-full h-full object-cover" muted />}
                  {added && <div className="absolute inset-0 bg-primary/30 flex items-center justify-center"><Check className="h-6 w-6 text-white" /></div>}
                </button>
              );
            })}
            {!media.length && <p className="col-span-full text-sm text-muted-foreground">Biblioteca vazia.</p>}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-3">Mídias da apresentação ({items.length})</h3>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">Nenhuma mídia. Envie ou selecione da biblioteca.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((m, idx) => (
              <div key={m.id + idx} className="group rounded-lg border bg-card overflow-hidden">
                <div className="relative aspect-video bg-black">
                  {m.type === "image" ? <img src={m.url} className="w-full h-full object-cover" alt="" /> : <video src={m.url} className="w-full h-full object-cover" muted />}
                  <button onClick={() => setPreview(m)} className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
                    <Eye className="h-7 w-7 text-white opacity-0 group-hover:opacity-100" />
                  </button>
                  <span className="absolute top-2 left-2 rounded bg-black/70 text-white text-[10px] px-2 py-0.5">#{idx + 1}</span>
                </div>
                <div className="p-2 flex items-center justify-between gap-2">
                  <span className="text-xs truncate flex items-center gap-1">{m.type === "image" ? <ImageIcon className="h-3 w-3" /> : <Film className="h-3 w-3" />} {m.name}</span>
                  <button onClick={async () => { if (await dialog.confirm({ title: "Remover da apresentação?", description: "A mídia continua disponível na biblioteca.", confirmLabel: "Remover", destructive: true })) setDraft((d) => ({ ...d, mediaIds: d.mediaIds.filter((_, i) => i !== idx) })); }} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>)}

      {isMultiZone && currentLayout && (
        <ZonesEditor
          layout={currentLayout}
          draft={draft}
          setDraft={setDraft}
          media={media}
          setPreview={setPreview}
        />
      )}

      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-zoom-out">
          {preview.type === "image" ? <img src={preview.url} className="max-h-full max-w-full object-contain" alt="" /> : <video src={preview.url} className="max-h-full max-w-full" controls autoPlay />}
        </div>
      )}
    </div>
  );
}

function ZonesEditor({ layout, draft, setDraft, media, setPreview }: {
  layout: Layout;
  draft: Presentation;
  setDraft: React.Dispatch<React.SetStateAction<Presentation>>;
  media: Media[];
  setPreview: (m: Media | null) => void;
}) {
  const setZone = (key: string, patch: Partial<ZoneBinding>) => {
    setDraft((d) => {
      const cur = d.zones?.[key] ?? { mediaIds: [], durationMs: d.durationMs };
      return { ...d, zones: { ...(d.zones ?? {}), [key]: { ...cur, ...patch } } };
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Layout: {layout.name}</h3>
        <p className="text-xs text-muted-foreground">{layout.description}</p>
      </div>

      {/* Visual layout preview */}
      <div className="relative w-full max-w-md aspect-video rounded-lg border-2 border-dashed border-primary/40 bg-black/40 overflow-hidden">
        {layout.zones.map((z) => (
          <div
            key={z.key}
            className="absolute border border-primary/50 bg-primary/10 flex items-center justify-center text-white/70 text-xs font-bold"
            style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` }}
          >
            Zona {z.key}
          </div>
        ))}
      </div>

      <div className={`grid gap-4 ${layout.zones.length > 1 ? "md:grid-cols-2" : ""}`}>
        {layout.zones.map((z) => {
          const binding = draft.zones?.[z.key] ?? { mediaIds: [], durationMs: draft.durationMs };
          return (
            <ZoneCard
              key={z.key}
              zoneKey={z.key}
              binding={binding}
              media={media}
              onChange={(patch) => setZone(z.key, patch)}
              setPreview={setPreview}
            />
          );
        })}
      </div>
    </div>
  );
}

function ZoneCard({ zoneKey, binding, media, onChange, setPreview }: {
  zoneKey: string;
  binding: ZoneBinding;
  media: Media[];
  onChange: (patch: Partial<ZoneBinding>) => void;
  setPreview: (m: Media | null) => void;
}) {
  const [showLib, setShowLib] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const items = binding.mediaIds.map((id) => media.find((m) => m.id === id)).filter(Boolean) as Media[];

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const added = await addMedia(files);
      onChange({ mediaIds: [...binding.mediaIds, ...added.map((a) => a.id)] });
      toast.success(`${added.length} mídia(s) enviada(s) para Zona ${zoneKey}`);
    } finally { setUploading(false); }
  };

  const removeAt = async (idx: number) => {
    if (await dialog.confirm({ title: `Remover da Zona ${zoneKey}?`, description: "A mídia continua disponível na biblioteca.", confirmLabel: "Remover", destructive: true })) {
      onChange({ mediaIds: binding.mediaIds.filter((_, i) => i !== idx) });
    }
  };

  return (
    <div className="premium-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">{zoneKey}</span>
          Zona {zoneKey}
          <span className="text-xs font-normal text-muted-foreground">({items.length} mídia{items.length !== 1 ? "s" : ""})</span>
        </h4>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">Duração (s):</span>
          <input
            type="number"
            min={1}
            value={binding.durationMs / 1000}
            onChange={(e) => onChange({ durationMs: Math.max(1, Number(e.target.value)) * 1000 })}
            className="w-16 rounded border px-2 py-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input ref={inputRef} type="file" multiple accept="image/*,video/mp4" className="hidden" onChange={(e) => onUpload(e.target.files)} />
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50">
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} {uploading ? "Enviando..." : "Upload"}
        </button>
        <button onClick={() => setShowLib((v) => !v)} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium">
          {showLib ? "Ocultar Biblioteca" : "Adicionar da Biblioteca"}
        </button>
      </div>

      {showLib && (
        <div className="rounded-lg border p-3 bg-card max-h-64 overflow-auto">
          <div className="grid grid-cols-3 gap-2">
            {media.map((m) => {
              const added = binding.mediaIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => onChange({ mediaIds: added ? binding.mediaIds.filter((x) => x !== m.id) : [...binding.mediaIds, m.id] })}
                  className={`relative aspect-video overflow-hidden rounded border-2 ${added ? "border-primary" : "border-transparent"}`}
                >
                  {m.type === "image" ? <img src={m.url} alt="" className="w-full h-full object-cover" /> : <video src={m.url} className="w-full h-full object-cover" muted />}
                  {added && <div className="absolute inset-0 bg-primary/30 flex items-center justify-center"><Check className="h-5 w-5 text-white" /></div>}
                </button>
              );
            })}
            {!media.length && <p className="col-span-full text-xs text-muted-foreground text-center py-4">Biblioteca vazia.</p>}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-xs">Nenhuma mídia nesta zona.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {items.map((m, idx) => (
            <div key={m.id + idx} className="group rounded border bg-card overflow-hidden">
              <div className="relative aspect-video bg-black">
                {m.type === "image" ? <img src={m.url} className="w-full h-full object-cover" alt="" /> : <video src={m.url} className="w-full h-full object-cover" muted />}
                <button onClick={() => setPreview(m)} className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition">
                  <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100" />
                </button>
                <span className="absolute top-1 left-1 rounded bg-black/70 text-white text-[10px] px-1.5 py-0.5">#{idx + 1}</span>
                <button onClick={() => removeAt(idx)} className="absolute top-1 right-1 rounded bg-black/70 hover:bg-destructive text-white p-1">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}