import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, ChevronRight, Save, Loader2, Upload, Check, ArrowLeft,
  Columns2, Rows2, GripVertical, Image as ImageIcon, Film,
} from "lucide-react";
import {
  useStore, addMedia, createSplitLayout, updateSplitLayout, deleteSplitLayout,
  resolveZone, DEFAULT_SPLIT_ZONE, SPLIT_ZONE2_MIN, SPLIT_ZONE2_MAX, SPLIT_MIN_ITEM_SECONDS,
  type Media, type SplitLayout, type SplitZone,
} from "@/lib/store";
import { dialog } from "@/components/PremiumDialog";
import { toast } from "sonner";
import { showSuccess } from "@/components/SuccessNeon";
import { ZonePlayer } from "@/components/SplitScreenPlayer";

export const Route = createFileRoute("/app/splitscreen")({
  head: () => ({
    meta: [
      { title: "SplitScreen — Clube Pirassununga" },
      { name: "description", content: "Divida o telão em duas zonas independentes com playlists próprias." },
      { property: "og:title", content: "SplitScreen — Clube Pirassununga" },
      { property: "og:description", content: "Divida o telão em duas zonas independentes com playlists próprias." },
    ],
  }),
  component: SplitScreenPage,
});

function SplitScreenPage() {
  const { splitLayouts, terminals } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = splitLayouts.find((l) => l.id === editingId) ?? null;

  const handleCreate = async () => {
    const name = await dialog.prompt({
      title: "Novo Layout SplitScreen",
      description: "Dê um nome para identificar este layout de tela dividida.",
      placeholder: "Ex: Jogo + Cardápio",
      confirmLabel: "Criar",
    });
    if (!name) return;
    const id = await createSplitLayout(name);
    if (id) { setEditingId(id); toast.success("Layout criado"); }
    else toast.error("Falha ao criar layout");
  };

  if (editing) {
    return <LayoutEditor key={editing.id} layout={editing} onBack={() => setEditingId(null)} />;
  }

  return (
    <div className="space-y-5 ccp-anim-fade">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">SplitScreen</h1>
          <p className="text-sm text-muted-foreground">Divida o telão em 2 zonas independentes, cada uma com sua própria playlist.</p>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-lg shadow-primary/30 hover:brightness-110 transition">
          <Plus className="h-4 w-4" /> Novo Layout SplitScreen
        </button>
      </div>

      <div className="premium-border divide-y divide-white/5">
        {splitLayouts.map((l) => {
          const term = terminals.find((t) => t.id === l.terminalId);
          return (
            <button key={l.id} onClick={() => setEditingId(l.id)} className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white/5 transition">
              <div className="min-w-0">
                <p className="font-semibold truncate">{l.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {term ? term.name : "Sem telão vinculado"} · {l.orientation === "vertical_direita" ? "Vertical à direita" : "Horizontal embaixo"} · Zona 2: {l.zone2Pct}%
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold ${l.active ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "bg-white/5 text-muted-foreground ring-1 ring-white/10"}`}>
                  {l.active ? "Ativo" : "Inativo"}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          );
        })}
        {!splitLayouts.length && (
          <p className="p-12 text-center text-sm text-muted-foreground">Nenhum layout SplitScreen criado ainda.</p>
        )}
      </div>
    </div>
  );
}

function LayoutEditor({ layout, onBack }: { layout: SplitLayout; onBack: () => void }) {
  const { terminals, media, presentations, splitLayouts } = useStore();
  const [draft, setDraft] = useState<SplitLayout>(layout);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(layout); }, [layout.id]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(layout);

  const z1Count = resolveZone(draft.zone1, presentations).mediaIds.length;
  const z2Count = resolveZone(draft.zone2, presentations).mediaIds.length;
  const canSave = !!draft.name.trim() && z1Count > 0 && z2Count > 0;

  const setZone = (k: "zone1" | "zone2", patch: Partial<SplitZone>) =>
    setDraft((d) => ({ ...d, [k]: { ...d[k], ...patch } }));

  const handleSave = async () => {
    if (!canSave) { toast.error("Cada zona precisa de pelo menos 1 mídia e o layout precisa de um nome."); return; }
    // One active layout per terminal
    if (draft.active && draft.terminalId) {
      const conflict = splitLayouts.find((l) => l.id !== draft.id && l.active && l.terminalId === draft.terminalId);
      if (conflict) {
        const ok = await dialog.confirm({
          title: "Este telão já tem um layout ativo",
          description: `"${conflict.name}" será desativado automaticamente ao ativar "${draft.name}". Deseja continuar?`,
          confirmLabel: "Ativar mesmo assim",
        });
        if (!ok) return;
      }
    }
    setSaving(true);
    try {
      await updateSplitLayout(draft.id, {
        name: draft.name, terminalId: draft.terminalId, orientation: draft.orientation,
        zone2Pct: draft.zone2Pct, active: draft.active, zone1: draft.zone1, zone2: draft.zone2,
      });
      showSuccess("Layout SplitScreen Salvo Com Sucesso");
    } catch { toast.error("Falha ao salvar"); }
    finally { setSaving(false); }
  };

  const vertical = draft.orientation === "vertical_direita";

  return (
    <div className="space-y-5 ccp-anim-slide">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-md border px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent"><ArrowLeft className="h-4 w-4" /> Voltar</button>
          <h2 className="text-2xl font-bold">{draft.name}</h2>
          {dirty && <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">alterações pendentes</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving || !dirty || !canSave} className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-lg shadow-primary/30 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Salvando..." : "Salvar Layout"}
          </button>
          <button onClick={async () => { if (await dialog.confirm({ title: "Excluir layout?", description: "Esta ação não pode ser desfeita.", confirmLabel: "Excluir", destructive: true })) { await deleteSplitLayout(draft.id); toast.success("Layout excluído"); onBack(); } }} className="text-destructive flex items-center gap-1 text-sm px-2"><Trash2 className="h-4 w-4" /> Excluir</button>
        </div>
      </div>

      {!canSave && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Para salvar: nome preenchido e pelo menos 1 mídia em cada zona (Zona 1: {z1Count} · Zona 2: {z2Count}).
        </p>
      )}

      {/* Configurações gerais */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="premium-border p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Nome do layout</span>
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Vincular à Tela/Telão</span>
              <select value={draft.terminalId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, terminalId: e.target.value || null }))} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm">
                <option value="">Nenhum telão</option>
                {terminals.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Orientação</span>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <OrientCard active={vertical} onClick={() => setDraft((d) => ({ ...d, orientation: "vertical_direita" }))} icon={<Columns2 className="h-4 w-4" />} title="Vertical à direita" desc="Zona 1 à esquerda · Zona 2 faixa vertical à direita" />
              <OrientCard active={!vertical} onClick={() => setDraft((d) => ({ ...d, orientation: "horizontal_baixo" }))} icon={<Rows2 className="h-4 w-4" />} title="Horizontal embaixo" desc="Zona 1 em cima · Zona 2 faixa horizontal embaixo" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Tamanho da Zona 2</span>
              <span className="text-sm font-semibold text-primary">{draft.zone2Pct}% <span className="text-muted-foreground font-normal">· Zona 1: {100 - draft.zone2Pct}%</span></span>
            </div>
            <input type="range" min={SPLIT_ZONE2_MIN} max={SPLIT_ZONE2_MAX} value={draft.zone2Pct} onChange={(e) => setDraft((d) => ({ ...d, zone2Pct: Number(e.target.value) }))} className="mt-2 w-full accent-[#EC1C24]" />
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted-foreground">Um telão só pode ter 1 layout SplitScreen ativo por vez.</p>
            </div>
            <Switch checked={draft.active} onChange={(v) => setDraft((d) => ({ ...d, active: v }))} label={draft.active ? "Ativo" : "Inativo"} />
          </div>
        </div>

        {/* Preview em tempo real */}
        <div className="premium-border p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Preview em tempo real</p>
          <div className="aspect-video w-full bg-black rounded-md overflow-hidden ring-1 ring-white/10">
            <div className={`h-full w-full flex ${vertical ? "flex-row" : "flex-col"}`}>
              <div className="relative min-h-0 min-w-0" style={vertical ? { width: `${100 - draft.zone2Pct}%` } : { height: `${100 - draft.zone2Pct}%` }}>
                <ZonePlayer zone={draft.zone1} media={media} presentations={presentations} />
                <ZoneBadge n={1} />
              </div>
              <div className="relative min-h-0 min-w-0 border-primary/60" style={vertical ? { width: `${draft.zone2Pct}%`, borderLeftWidth: 2 } : { height: `${draft.zone2Pct}%`, borderTopWidth: 2 }}>
                <ZonePlayer zone={draft.zone2} media={media} presentations={presentations} />
                <ZoneBadge n={2} />
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">As zonas avançam de forma independente — uma não espera a outra.</p>
        </div>
      </div>

      <ZoneEditor n={1} zone={draft.zone1} onChange={(p) => setZone("zone1", p)} media={media} presentations={presentations} />
      <ZoneEditor n={2} zone={draft.zone2} onChange={(p) => setZone("zone2", p)} media={media} presentations={presentations} />
    </div>
  );
}

function ZoneBadge({ n }: { n: number }) {
  return <span className="absolute top-1 left-1 rounded bg-black/70 text-white text-[9px] px-1.5 py-0.5 uppercase tracking-wider">Zona {n}</span>;
}

function OrientCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button onClick={onClick} className={`text-left rounded-lg border p-3 transition ${active ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-white/10 hover:bg-white/5"}`}>
      <span className="flex items-center gap-2 text-sm font-semibold">{icon} {title}</span>
      <span className="mt-1 block text-[11px] text-muted-foreground">{desc}</span>
    </button>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2">
      {label && <span className={`text-xs font-semibold ${checked ? "text-primary" : "text-muted-foreground"}`}>{label}</span>}
      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-primary" : "bg-white/15"}`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

function ZoneEditor({ n, zone, onChange, media, presentations }: {
  n: 1 | 2;
  zone: SplitZone;
  onChange: (p: Partial<SplitZone>) => void;
  media: Media[];
  presentations: ReturnType<typeof useStore>["presentations"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showLib, setShowLib] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const linked = presentations.find((p) => p.id === zone.presentationId) ?? null;
  const items = useMemo(
    () => zone.mediaIds.map((id) => media.find((m) => m.id === id)).filter(Boolean) as Media[],
    [zone.mediaIds, media]
  );
  const linkedItems = useMemo(
    () => (linked?.mediaIds ?? []).map((id) => media.find((m) => m.id === id)).filter(Boolean) as Media[],
    [linked?.mediaIds, media]
  );

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const res = await addMedia(files, `SplitScreen — Zona ${n}`);
      if (res.blocked) { toast.error("Armazenamento da Biblioteca Cheio, Remova uma Imagem/Vídeo Para Fazer um Upload"); return; }
      onChange({ mediaIds: [...zone.mediaIds, ...res.added.map((a) => a.id)] });
      toast.success(`${res.added.length} mídia(s) enviada(s) e indexada(s) na Biblioteca`);
    } finally { setUploading(false); }
  };

  const reorder = (from: number, to: number) => {
    const next = [...zone.mediaIds];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ mediaIds: next });
  };

  return (
    <div className="premium-border p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span className="rounded bg-primary/15 text-primary ring-1 ring-primary/40 px-2 py-0.5 text-xs uppercase tracking-wider">Zona {n}</span>
          {n === 1 ? "Área principal" : "Faixa secundária"}
        </h3>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Letter Box</span>
            <Switch checked={zone.letterbox} onChange={(v) => onChange({ letterbox: v })} />
          </div>
          {zone.letterbox ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Barras:
              <select value={zone.fillStyle} onChange={(e) => onChange({ fillStyle: e.target.value as SplitZone["fillStyle"] })} className="rounded border bg-background px-2 py-1 text-xs">
                <option value="blur">Blur do conteúdo</option>
                <option value="red">Vermelho do clube</option>
                <option value="white">Branco</option>
              </select>
            </label>
          ) : (
            <span className="text-[11px] text-muted-foreground">Mídia cortada para preencher a zona</span>
          )}
        </div>
      </div>

      {/* Origem do conteúdo */}
      <div className="grid grid-cols-2 gap-3">
        <OrientCard active={zone.source === "presentation"} onClick={() => onChange({ source: "presentation" })} icon={<Film className="h-4 w-4" />} title="Vincular apresentação existente" desc="Espelha ordem, duração e transições da apresentação original." />
        <OrientCard active={zone.source === "playlist"} onClick={() => onChange({ source: "playlist" })} icon={<ImageIcon className="h-4 w-4" />} title="Criar playlist nova" desc="Playlist dedicada a esta zona, com upload próprio." />
      </div>

      {zone.source === "presentation" ? (
        <div className="space-y-3">
          <label className="block max-w-md">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Apresentação</span>
            <select value={zone.presentationId ?? ""} onChange={(e) => onChange({ presentationId: e.target.value || null })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm">
              <option value="">Selecionar apresentação</option>
              {presentations.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mediaIds.length} itens)</option>)}
            </select>
          </label>
          {linked && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                Fonte única de verdade: alterações feitas na aba Apresentações refletem aqui automaticamente.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Info label="Itens" value={String(linked.mediaIds.length)} />
                <Info label="Duração/item" value={`${Math.round(linked.durationMs / 1000)}s`} />
                <Info label="Transição" value={linked.transition ?? "fade"} />
                <Info label="Loop" value={linked.loop ? "Sim" : "Não"} />
                <Info label="Criada em" value={new Date().toLocaleDateString("pt-BR")} />
              </div>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {linkedItems.map((m, i) => (
                  <div key={m.id + i} className="aspect-video rounded overflow-hidden bg-black">
                    {m.type === "image" ? <img src={m.url} alt="" className="h-full w-full object-cover" /> : <video src={m.url} muted className="h-full w-full object-cover" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Descrição</span>
            <input value={zone.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Ex: Cardápio do bar" className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm" />
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Duração por item (s):
              <input type="number" min={SPLIT_MIN_ITEM_SECONDS} value={Math.round(zone.durationMs / 1000)} onChange={(e) => onChange({ durationMs: Math.max(SPLIT_MIN_ITEM_SECONDS, Number(e.target.value)) * 1000 })} className="w-20 rounded border bg-background px-2 py-1 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Transição:
              <select value={zone.transition} onChange={(e) => onChange({ transition: e.target.value as SplitZone["transition"] })} className="rounded border bg-background px-2 py-1 text-xs">
                <option value="cut">Corte seco</option>
                <option value="fade">Fade</option>
              </select>
            </label>
            <span className="text-[11px] text-muted-foreground">Vídeos usam a duração nativa do arquivo. Mínimo de {SPLIT_MIN_ITEM_SECONDS}s para imagens.</span>
          </div>

          <div className="flex items-center gap-2">
            <input ref={inputRef} type="file" multiple accept="image/*,video/mp4" className="hidden" onChange={(e) => onUpload(e.target.files)} />
            <button onClick={() => inputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {uploading ? "Enviando..." : "Upload"}
            </button>
            <button onClick={() => setShowLib((v) => !v)} className="rounded-md border px-4 py-2 text-sm font-medium">{showLib ? "Ocultar" : "Adicionar da"} Biblioteca</button>
            <span className="text-[11px] text-muted-foreground">Todo upload é indexado na Biblioteca central com a tag "SplitScreen — Zona {n}".</span>
          </div>

          {showLib && (
            <div className="rounded-lg border p-4 bg-card">
              <p className="text-sm font-medium mb-3">Clique para adicionar/remover desta zona</p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {media.map((m) => {
                  const added = zone.mediaIds.includes(m.id);
                  return (
                    <button key={m.id} onClick={() => onChange({ mediaIds: added ? zone.mediaIds.filter((x) => x !== m.id) : [...zone.mediaIds, m.id] })} className={`relative aspect-video overflow-hidden rounded border-2 ${added ? "border-primary" : "border-transparent"}`}>
                      {m.type === "image" ? <img src={m.url} alt="" className="w-full h-full object-cover" /> : <video src={m.url} className="w-full h-full object-cover" muted />}
                      {added && <div className="absolute inset-0 bg-primary/30 flex items-center justify-center"><Check className="h-5 w-5 text-white" /></div>}
                    </button>
                  );
                })}
                {!media.length && <p className="col-span-full text-sm text-muted-foreground">Biblioteca vazia.</p>}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold mb-2">Playlist da Zona {n} ({items.length}) <span className="font-normal text-xs text-muted-foreground">— arraste para reordenar</span></p>
            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">Nenhuma mídia nesta zona.</div>
            ) : (
              <div className="space-y-2">
                {items.map((m, i) => (
                  <div
                    key={m.id + i}
                    draggable
                    onDragStart={() => { dragIdx.current = i; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragIdx.current !== null && dragIdx.current !== i) reorder(dragIdx.current, i); dragIdx.current = null; }}
                    className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-6 shrink-0">#{i + 1}</span>
                    <div className="h-10 w-16 rounded overflow-hidden bg-black shrink-0">
                      {m.type === "image" ? <img src={m.url} alt="" className="h-full w-full object-cover" /> : <video src={m.url} muted className="h-full w-full object-cover" />}
                    </div>
                    <span className="text-xs truncate flex items-center gap-1 flex-1">
                      {m.type === "image" ? <ImageIcon className="h-3 w-3" /> : <Film className="h-3 w-3" />} {m.name}
                    </span>
                    <button onClick={() => onChange({ mediaIds: zone.mediaIds.filter((_, x) => x !== i) })} className="text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-white/5 ring-1 ring-white/10 px-2.5 py-1">
      <span className="text-muted-foreground">{label}: </span><span className="font-semibold">{value}</span>
    </span>
  );
}