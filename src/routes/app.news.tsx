import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Pencil, Check, X, AlertTriangle, ArrowUp, ArrowDown,
  Power, Megaphone, Bold, Italic, Underline, Paintbrush, Loader2, Type, Settings2, Eye,
} from "lucide-react";
import {
  useStore,
  createTickerMessage,
  updateTickerMessage,
  deleteTickerMessage,
  reorderTickerMessages,
  updateTickerSettings,
  TICKER_HEIGHT_MIN,
  TICKER_HEIGHT_MAX,
  type TickerMessage,
  type TickerSettings,
} from "@/lib/store";
import { dialog } from "@/components/PremiumDialog";
import { TickerBar } from "@/components/TickerBar";
import { toast } from "sonner";
import { showSuccess } from "@/components/SuccessNeon";
import mockupImg from "@/assets/mockup-proporcao.jpg";

export const Route = createFileRoute("/app/news")({ component: NewsPage });

const LABEL_PRESETS = ["AVISO", "URGENTE", "EVENTO", "INSTITUCIONAL", "CLUBE PIRASSUNUNGA"];
const COLOR_PRESETS = ["#dc2626", "#ea580c", "#0369a1", "#166534", "#111827"];
const FONT_FAMILIES = [
  "Arial", "Times New Roman", "Roboto", "Verdana",
  "Georgia", "Calibri", "Tahoma", "Courier New",
];
const MAX_CHARS = 150;
const SAVE_DELAY_MS = 6000;

function stripHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "");
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

function toLocalInput(ts: number | null) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return isFinite(t) ? t : null;
}

function NewsPage() {
  const { tickerMessages, terminals, tickerSettings } = useStore();
  const [editing, setEditing] = useState<TickerMessage | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingDelay, setSavingDelay] = useState(false);

  const sorted = useMemo(
    () =>
      [...tickerMessages].sort(
        (a, b) => (Number(b.priority) - Number(a.priority)) || (a.orderIndex - b.orderIndex),
      ),
    [tickerMessages],
  );

  const openNew = () => {
    setEditing({
      id: "",
      text: "<span>Nova mensagem</span>",
      label: "AVISO",
      color: "#dc2626",
      priority: false,
      active: true,
      orderIndex: 0,
      startsAt: null,
      endsAt: null,
      terminalIds: [],
      createdAt: Date.now(),
    });
    setCreating(true);
  };

  const save = async (m: TickerMessage) => {
    const plain = stripHtml(m.text).trim();
    if (!plain) { toast.error("Escreva o texto da mensagem"); return; }
    if (plain.length > MAX_CHARS) { toast.error(`Máximo de ${MAX_CHARS} caracteres`); return; }
    setSavingDelay(true);
    const wasCreating = creating;
    const snapshotPrev = wasCreating ? null : tickerMessages.find((x) => x.id === m.id) ?? null;
    // Close editor immediately; keep a subtle inline spinner via SuccessNeon later.
    setEditing(null); setCreating(false);
    // 6s pre-processing delay
    await new Promise((r) => setTimeout(r, SAVE_DELAY_MS));
    try {
      let newId: string | null = null;
      if (wasCreating) {
        newId = await createTickerMessage({
          text: m.text,
          label: m.label, color: m.color, priority: m.priority, active: m.active,
          startsAt: m.startsAt, endsAt: m.endsAt, terminalIds: m.terminalIds,
        });
      } else {
        await updateTickerMessage(m.id, {
          text: m.text, label: m.label, color: m.color, priority: m.priority, active: m.active,
          startsAt: m.startsAt, endsAt: m.endsAt, terminalIds: m.terminalIds,
        });
      }
      showSuccess("Mensagem Salva Com Sucesso", {
        undo: async () => {
          if (wasCreating && newId) await deleteTickerMessage(newId);
          else if (snapshotPrev) {
            await updateTickerMessage(snapshotPrev.id, {
              text: snapshotPrev.text, label: snapshotPrev.label, color: snapshotPrev.color,
              priority: snapshotPrev.priority, active: snapshotPrev.active,
              startsAt: snapshotPrev.startsAt, endsAt: snapshotPrev.endsAt,
              terminalIds: snapshotPrev.terminalIds,
            });
          }
          toast.message("Alteração desfeita");
        },
      });
    } catch {
      toast.error("Falha ao salvar");
    } finally { setSavingDelay(false); }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...sorted];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    await reorderTickerMessages(next.map((m) => m.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="h-6 w-6 text-primary" /> Faixa de Notícias</h1>
          <p className="text-sm text-muted-foreground">
            Mensagens em rolagem exibidas no rodapé de todas as telas. Sincronização em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savingDelay && (
            <span className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <Loader2 className="h-3 w-3 animate-spin" /> Processando...
            </span>
          )}
          <button onClick={openNew} className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
            <Plus className="h-4 w-4" /> Nova Mensagem
          </button>
        </div>
      </div>

      {/* Proportion mockup + global settings */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4">
        <div className="premium-border p-4 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /> Guia de proporção 16:9</p>
          <img src={mockupImg} alt="Guia com e sem faixa" loading="lazy" width={1536} height={768} className="w-full rounded-lg object-contain bg-white" />
          <p className="text-xs text-muted-foreground">
            A faixa nunca sobrepõe a imagem. O conteúdo é reduzido proporcionalmente (letterbox) para caber acima da faixa. Altura máxima: <b>5&nbsp;cm (~189&nbsp;px)</b>.
          </p>
        </div>
        <GlobalSettingsPanel settings={tickerSettings} />
      </div>

      {/* Live preview (16:9) with real content + live ticker */}
      <div className="premium-border p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Eye className="h-3 w-3" /> Pré-visualização em tempo real</p>
        <div className="relative w-full mx-auto max-w-3xl aspect-video bg-black rounded-lg overflow-hidden flex flex-col">
          <div className="relative flex-1 min-h-0 bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center text-white/25 text-xs">
            (área da imagem/vídeo — letterbox)
          </div>
          <TickerBar variant="inline" />
        </div>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
            Nenhuma mensagem cadastrada. Clique em <b>Nova Mensagem</b> para começar.
          </div>
        )}
        {sorted.map((m, i) => {
          const inactive = !m.active;
          return (
            <div key={m.id} className={`premium-border p-4 flex items-center gap-3 ${inactive ? "opacity-50" : ""}`}>
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowUp className="h-3 w-3" /></button>
                <button onClick={() => move(i, +1)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowDown className="h-3 w-3" /></button>
              </div>
              <span
                className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1"
                style={{ background: m.color }}
              >
                {m.priority && <AlertTriangle className="h-3 w-3" />}
                {m.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm" dangerouslySetInnerHTML={{ __html: m.text }} />
                <p className="text-[10px] text-muted-foreground">
                  {m.terminalIds.length === 0 ? "Todos os terminais" : `${m.terminalIds.length} terminal(is)`}
                  {m.startsAt && ` · início ${new Date(m.startsAt).toLocaleString()}`}
                  {m.endsAt && ` · fim ${new Date(m.endsAt).toLocaleString()}`}
                </p>
              </div>
              <button
                onClick={() => updateTickerMessage(m.id, { active: !m.active })}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${m.active ? "text-green-500 border-green-500/40" : "text-muted-foreground"}`}
                title={m.active ? "Ativa" : "Inativa"}
              >
                <Power className="h-3 w-3" />
              </button>
              <button onClick={() => { setEditing(m); setCreating(false); }} className="rounded-md border p-2 hover:bg-accent">
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={async () => {
                  if (await dialog.confirm({ title: "Excluir mensagem?", description: "Ela será removida imediatamente de todos os terminais.", confirmLabel: "Excluir", destructive: true })) {
                    await deleteTickerMessage(m.id);
                    toast.success("Mensagem excluída");
                  }
                }}
                className="rounded-md border border-destructive/40 text-destructive p-2"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {editing && (
        <MessageEditor
          message={editing}
          creating={creating}
          terminals={terminals}
          onCancel={() => { setEditing(null); setCreating(false); }}
          onChange={setEditing}
          onSave={() => save(editing)}
        />
      )}
    </div>
  );
}

/* ============================================================
   Global ticker settings panel (height / font family / bg color)
   ============================================================ */
function GlobalSettingsPanel({ settings }: { settings: TickerSettings }) {
  const [local, setLocal] = useState<TickerSettings>(settings);
  useEffect(() => { setLocal(settings); }, [settings.heightPx, settings.fontFamily, settings.bgColor, settings.bgOpacity]);
  const [saving, setSaving] = useState(false);

  const commit = async (patch: Partial<TickerSettings>) => {
    setLocal((s) => ({ ...s, ...patch }));
    setSaving(true);
    try { await updateTickerSettings(patch); } finally { setSaving(false); }
  };

  return (
    <div className="premium-border p-4 space-y-4">
      <p className="text-sm font-semibold flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary" /> Configuração global da faixa
        {saving && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
      </p>
      <p className="text-xs text-muted-foreground">
        Estas configurações se aplicam a <b>todos os terminais</b> simultaneamente.
      </p>

      <div>
        <label className="text-xs text-muted-foreground flex items-center justify-between">
          <span>Altura da faixa</span>
          <span className="font-mono text-foreground">{local.heightPx}px (~{(local.heightPx / 37.8).toFixed(2)}cm)</span>
        </label>
        <input
          type="range" min={TICKER_HEIGHT_MIN} max={TICKER_HEIGHT_MAX} value={local.heightPx}
          onChange={(e) => setLocal((s) => ({ ...s, heightPx: Number(e.target.value) }))}
          onMouseUp={(e) => commit({ heightPx: Number((e.target as HTMLInputElement).value) })}
          onTouchEnd={(e) => commit({ heightPx: Number((e.target as HTMLInputElement).value) })}
          className="w-full accent-primary"
        />
        <p className="text-[10px] text-muted-foreground">Mín. {TICKER_HEIGHT_MIN}px · Máx. {TICKER_HEIGHT_MAX}px (5&nbsp;cm)</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Família de fonte</label>
          <select
            value={local.fontFamily}
            onChange={(e) => commit({ fontFamily: e.target.value })}
            className="w-full mt-1 rounded border bg-background px-2 py-2 text-sm"
            style={{ fontFamily: local.fontFamily }}
          >
            {FONT_FAMILIES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Fundo da faixa</label>
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={local.bgColor} onChange={(e) => commit({ bgColor: e.target.value })} className="h-9 w-12 rounded border" />
            <div className="flex-1">
              <input
                type="range" min={0} max={1} step={0.05} value={local.bgOpacity}
                onChange={(e) => setLocal((s) => ({ ...s, bgOpacity: Number(e.target.value) }))}
                onMouseUp={(e) => commit({ bgOpacity: Number((e.target as HTMLInputElement).value) })}
                onTouchEnd={(e) => commit({ bgOpacity: Number((e.target as HTMLInputElement).value) })}
                className="w-full accent-primary"
              />
              <p className="text-[10px] text-muted-foreground">Opacidade {Math.round(local.bgOpacity * 100)}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Rich message editor with 8 fonts, bold/italic/underline, color, format brush
   ============================================================ */
type MsgEditorProps = {
  message: TickerMessage;
  creating: boolean;
  terminals: { id: string; name: string }[];
  onChange: (m: TickerMessage) => void;
  onCancel: () => void;
  onSave: () => void;
};

function MessageEditor({ message, creating, terminals, onChange, onCancel, onSave }: MsgEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [brushArmed, setBrushArmed] = useState(false);
  const brushStyleRef = useRef<{ fontFamily?: string; fontSize?: string; color?: string; bold?: boolean; italic?: boolean; underline?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  // Set initial HTML
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== message.text) {
      editorRef.current.innerHTML = message.text || "";
    }
  }, []); // eslint-disable-line

  const syncHtml = () => {
    if (!editorRef.current) return;
    let html = editorRef.current.innerHTML;
    const plain = stripHtml(html);
    if (plain.length > MAX_CHARS) {
      // Trim to MAX_CHARS in plaintext: fall back to trimmed plain text.
      html = plain.slice(0, MAX_CHARS);
      editorRef.current.innerText = html;
    }
    onChange({ ...message, text: editorRef.current.innerHTML });
  };

  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
    syncHtml();
  };

  // Keyboard shortcuts: Ctrl+N bold, Ctrl+I italic, Ctrl+S underline (avoid save default)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "n" || key === "b") { e.preventDefault(); exec("bold"); }
      else if (key === "i") { e.preventDefault(); exec("italic"); }
      else if (key === "s" || key === "u") { e.preventDefault(); exec("underline"); }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line

  const captureBrush = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return toast.error("Selecione um trecho para copiar o estilo");
    const node = sel.anchorNode?.parentElement;
    if (!node) return;
    const cs = window.getComputedStyle(node);
    brushStyleRef.current = {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      color: cs.color,
      bold: cs.fontWeight === "bold" || parseInt(cs.fontWeight, 10) >= 600,
      italic: cs.fontStyle === "italic",
      underline: cs.textDecorationLine.includes("underline"),
    };
    setBrushArmed(true);
    toast.message("Pincel armado — selecione outro trecho para aplicar");
  };

  const applyBrush = () => {
    if (!brushArmed || !brushStyleRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const s = brushStyleRef.current;
    if (s.fontFamily) exec("fontName", s.fontFamily.split(",")[0].replace(/['"]/g, "").trim());
    if (s.color) exec("foreColor", rgbToHex(s.color));
    // execCommand fontSize accepts 1-7; we use CSS override via styleWithCSS.
    document.execCommand("styleWithCSS", false, "true");
    if (s.fontSize) exec("fontSize", "3");
    // Wrap selection with a span carrying explicit font-size to bypass 1-7 mapping.
    if (s.fontSize) {
      const range = sel.getRangeAt(0);
      const span = document.createElement("span");
      span.style.fontSize = s.fontSize;
      try { range.surroundContents(span); } catch { /* selection spans multiple nodes */ }
      syncHtml();
    }
    if (s.bold) exec("bold");
    if (s.italic) exec("italic");
    if (s.underline) exec("underline");
    setBrushArmed(false);
  };

  const plainLen = stripHtml(message.text).length;

  const handleSubmit = async () => {
    setSaving(true);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={onCancel}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 text-white shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{creating ? "Nova mensagem" : "Editar mensagem"}</h3>
          <button onClick={onCancel} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div>
          <label className="text-xs text-white/60">Texto da mensagem</label>
          {/* Toolbar */}
          <div className="mt-1 flex flex-wrap items-center gap-1 rounded-t border border-white/10 bg-black/40 p-1.5">
            <select
              onChange={(e) => { if (e.target.value) exec("fontName", e.target.value); e.currentTarget.selectedIndex = 0; }}
              className="rounded bg-white/5 border border-white/10 text-xs px-2 py-1"
              defaultValue=""
            >
              <option value="" disabled>Fonte</option>
              {FONT_FAMILIES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
            <select
              onChange={(e) => {
                if (!e.target.value) return;
                document.execCommand("styleWithCSS", false, "true");
                // wrap selection in span with explicit px size
                const sel = window.getSelection();
                if (sel && sel.rangeCount && !sel.isCollapsed) {
                  const range = sel.getRangeAt(0);
                  const span = document.createElement("span");
                  span.style.fontSize = `${e.target.value}px`;
                  try { range.surroundContents(span); } catch { /* multi-node */ }
                  syncHtml();
                }
                e.currentTarget.selectedIndex = 0;
              }}
              className="rounded bg-white/5 border border-white/10 text-xs px-2 py-1"
              defaultValue=""
            >
              <option value="" disabled>Tam.</option>
              {[12, 14, 16, 18, 20, 22, 24].map((s) => <option key={s} value={s}>{s}px</option>)}
            </select>
            <span className="mx-1 h-5 w-px bg-white/10" />
            <ToolBtn title="Negrito (Ctrl+N)" onClick={() => exec("bold")}><Bold className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn title="Itálico (Ctrl+I)" onClick={() => exec("italic")}><Italic className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn title="Sublinhado (Ctrl+S)" onClick={() => exec("underline")}><Underline className="h-3.5 w-3.5" /></ToolBtn>
            <span className="mx-1 h-5 w-px bg-white/10" />
            <label className="flex items-center gap-1 rounded px-2 py-1 text-xs cursor-pointer hover:bg-white/5" title="Cor do texto">
              <Type className="h-3.5 w-3.5" />
              <input type="color" onChange={(e) => exec("foreColor", e.target.value)} className="h-4 w-4 border-0 bg-transparent p-0" />
            </label>
            <button
              type="button"
              title={brushArmed ? "Clique em uma seleção para aplicar" : "Copiar formatação (pincel)"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => brushArmed ? applyBrush() : captureBrush()}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition ${brushArmed ? "bg-primary/30 text-primary" : "hover:bg-white/5 text-white/70"}`}
            >
              <Paintbrush className="h-3.5 w-3.5" /> {brushArmed ? "Aplicar" : "Pincel"}
            </button>
            <span className="ml-auto text-[11px] text-white/50 font-mono">{plainLen}/{MAX_CHARS}</span>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={syncHtml}
            onMouseUp={() => brushArmed && applyBrush()}
            className="min-h-[88px] rounded-b border-x border-b border-white/10 bg-black/40 px-3 py-2 text-sm outline-none prose-rte"
            style={{ fontFamily: "Roboto" }}
          />
          {plainLen >= MAX_CHARS && (
            <p className="text-[11px] text-red-400 mt-1">Limite de {MAX_CHARS} caracteres atingido</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60">Etiqueta</label>
            <input
              list="ticker-labels"
              value={message.label}
              onChange={(e) => onChange({ ...message, label: e.target.value.toUpperCase() })}
              className="w-full mt-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm uppercase"
            />
            <datalist id="ticker-labels">
              {LABEL_PRESETS.map((l) => <option key={l} value={l} />)}
            </datalist>
          </div>
          <div>
            <label className="text-xs text-white/60">Cor da etiqueta</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={message.color} onChange={(e) => onChange({ ...message, color: e.target.value })} className="h-9 w-12 rounded border border-white/10 bg-black/40" />
              <div className="flex gap-1">
                {COLOR_PRESETS.map((c) => (
                  <button key={c} onClick={() => onChange({ ...message, color: c })} className="h-6 w-6 rounded-full border border-white/20" style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm cursor-pointer">
            <input type="checkbox" checked={message.priority} onChange={(e) => onChange({ ...message, priority: e.target.checked })} className="h-4 w-4 accent-primary" />
            Urgente / prioridade
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm cursor-pointer">
            <input type="checkbox" checked={message.active} onChange={(e) => onChange({ ...message, active: e.target.checked })} className="h-4 w-4 accent-primary" />
            Ativa
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60">Início (opcional)</label>
            <input type="datetime-local" value={toLocalInput(message.startsAt)} onChange={(e) => onChange({ ...message, startsAt: fromLocalInput(e.target.value) })} className="w-full mt-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60">Expiração (opcional)</label>
            <input type="datetime-local" value={toLocalInput(message.endsAt)} onChange={(e) => onChange({ ...message, endsAt: fromLocalInput(e.target.value) })} className="w-full mt-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60">Terminais</label>
          <p className="text-[11px] text-white/40 mb-1">Deixe tudo desmarcado para exibir em <b>todos os terminais</b>.</p>
          <div className="max-h-40 overflow-auto rounded border border-white/10 bg-black/30 p-2 space-y-1">
            {terminals.length === 0 && <p className="text-xs text-white/40">Nenhum terminal cadastrado.</p>}
            {terminals.map((t) => {
              const checked = message.terminalIds.includes(t.id);
              return (
                <label key={t.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const set = new Set(message.terminalIds);
                      if (e.target.checked) set.add(t.id); else set.delete(t.id);
                      onChange({ ...message, terminalIds: Array.from(set) });
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  {t.name}
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:brightness-110 flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {creating ? "Publicar" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex items-center rounded px-2 py-1 text-white/80 hover:text-white hover:bg-white/5 transition"
    >
      {children}
    </button>
  );
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return rgb;
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(+m[0])}${to(+m[1])}${to(+m[2])}`;
}