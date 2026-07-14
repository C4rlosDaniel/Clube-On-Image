import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Eye, Pencil, Check, X, Upload, Image as ImageIcon, Film, ChevronRight, Save, Loader2 } from "lucide-react";
import { useStore, createPresentation, updatePresentation, deletePresentation, addMedia, type Media, type Presentation } from "@/lib/store";
import { dialog } from "@/components/PremiumDialog";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/RichTextEditor";

export const Route = createFileRoute("/app/presentations")({ component: Pres });

function Pres() {
  const { presentations, media } = useStore();
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
        {selected ? <Editor key={selected.id} pres={selected} media={media} /> : <div className="premium-border p-16 text-center text-muted-foreground">Selecione ou crie uma apresentação.</div>}
      </section>
    </div>
  );
}

function Editor({ pres, media }: { pres: Presentation; media: Media[] }) {
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

      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8 cursor-zoom-out">
          {preview.type === "image" ? <img src={preview.url} className="max-h-full max-w-full object-contain" alt="" /> : <video src={preview.url} className="max-h-full max-w-full" controls autoPlay />}
        </div>
      )}
    </div>
  );
}