import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Pencil, Check, X, AlertTriangle, ArrowUp, ArrowDown,
  Power, Megaphone, Bold, Italic, Underline, Paintbrush, Loader2, Type, Settings2, Eye, Save, RotateCcw, Zap,
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
  TICKER_HEIGHT_MIN_CM,
  TICKER_HEIGHT_MAX_CM,
  TICKER_SPEED_MIN,
  TICKER_SPEED_MAX,
  TICKER_FONT_MIN,
  TICKER_FONT_MAX,
  TICKER_FONT_SIZES,
  PX_PER_CM,
  type TickerMessage,
  type TickerSettings,
} from "@/lib/store";
import { dialog } from "@/components/PremiumDialog";
import { TickerBar } from "@/components/TickerBar";
import { toast } from "sonner";
import { showSuccess } from "@/components/SuccessNeon";
import { BlockingLoader } from "@/components/BlockingLoader";
import previewSample from "@/assets/preview-sample.jpg";

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
  const [processing, setProcessing] = useState<{ show: boolean; label: string }>({ show: false, label: "" });

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
    const wasCreating = creating;
    const snapshotPrev = wasCreating ? null : tickerMessages.find((x) => x.id === m.id) ?? null;
    setEditing(null); setCreating(false);
    setProcessing({ show: true, label: "Salvando mensagem..." });
    // 6s pre-processing delay (central blocking loader)
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
    } finally { setProcessing({ show: false, label: "" }); }
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
      <BlockingLoader show={processing.show} label={processing.label} sublabel="Aguarde alguns segundos, aplicando em todos os terminais." durationMs={SAVE_DELAY_MS} />

      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="h-6 w-6 text-primary" /> Faixa de Notícias</h1>
          <p className="text-sm text-muted-foreground">
            Mensagens em rolagem exibidas no rodapé de todas as telas. Sincronização em tempo real.
          </p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Nova Mensagem
        </button>
      </div>

      {/* Global settings (with Save/Cancel + live ruler preview) */}
      <GlobalSettingsPanel
        settings={tickerSettings}
        onProcessing={(label) => setProcessing({ show: true, label })}
        onDone={() => setProcessing({ show: false, label: "" })}
      />

      {/* Live preview: 16:9 canvas with the real ticker below the image */}
      <div className="premium-border p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Eye className="h-3 w-3" /> PreView</p>
        <div className="relative w-full mx-auto max-w-3xl aspect-video bg-black rounded-lg overflow-hidden flex flex-col">
          <div className="relative flex-1 min-h-0 overflow-hidden">
            <img
              src={previewSample}
              alt="Exemplo de conteúdo do terminal"
              className="absolute inset-0 h-full w-full"
              style={{ objectFit: tickerSettings.letterboxMode ? "contain" : "cover", objectPosition: "center", background: "#000" }}
              loading="lazy"
            />
            {!tickerSettings.letterboxMode && <TickerBar variant="overlay" forceVisible />}
          </div>
          {tickerSettings.letterboxMode && <TickerBar variant="inline" forceVisible />}
        </div>
      </div>

      {/* Global visibility toggles (Material-style) */}
      <GlobalVisibilityPanel
        settings={tickerSettings}
        onProcessing={(label) => setProcessing({ show: true, label })}
        onDone={() => setProcessing({ show: false, label: "" })}
      />

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
   Global ticker settings panel (draft + Save/Cancel + ruler preview)
   ============================================================ */
type GlobalPanelProps = {
  settings: TickerSettings;
  onProcessing: (label: string) => void;
  onDone: () => void;
};

function GlobalSettingsPanel({ settings, onProcessing, onDone }: GlobalPanelProps) {
  // draft = editable, un-saved state. Real preview only updates after Save.
  const [draft, setDraft] = useState<TickerSettings>(settings);
  const [cancelSpin, setCancelSpin] = useState(false);
  // Sync when the real settings change (e.g. realtime update from another admin).
  useEffect(() => { setDraft(settings); }, [settings.heightPx, settings.fontFamily, settings.bgColor, settings.bgOpacity, settings.scrollSpeed, settings.visibleAll, settings.fontMin, settings.fontMax, settings.letterboxMode]);

  const dirty =
    draft.heightPx !== settings.heightPx ||
    draft.fontFamily !== settings.fontFamily ||
    draft.bgColor !== settings.bgColor ||
    draft.bgOpacity !== settings.bgOpacity ||
    draft.scrollSpeed !== settings.scrollSpeed ||
    draft.fontMax !== settings.fontMax ||
    draft.letterboxMode !== settings.letterboxMode;

  const heightCm = draft.heightPx / PX_PER_CM;

  const setHeightCm = (cm: number) => {
    const clamped = Math.max(TICKER_HEIGHT_MIN_CM, Math.min(TICKER_HEIGHT_MAX_CM, cm));
    setDraft((s) => ({ ...s, heightPx: Math.round(clamped * PX_PER_CM) }));
  };
  const setSpeed = (v: number) => {
    const clamped = Math.max(TICKER_SPEED_MIN, Math.min(TICKER_SPEED_MAX, Number(v.toFixed(1))));
    setDraft((s) => ({ ...s, scrollSpeed: clamped }));
  };
  const setFontSize = (v: number) => {
    const clamped = Math.max(TICKER_FONT_MIN, Math.min(TICKER_FONT_MAX, Math.round(v)));
    setDraft((s) => ({ ...s, fontMax: clamped, fontMin: clamped }));
  };

  const doSave = async () => {
    onProcessing("Salvando configuração da faixa...");
    await new Promise((r) => setTimeout(r, SAVE_DELAY_MS));
    try {
      await updateTickerSettings({
        heightPx: draft.heightPx,
        fontFamily: draft.fontFamily,
        bgColor: draft.bgColor,
        bgOpacity: draft.bgOpacity,
        scrollSpeed: draft.scrollSpeed,
        fontMin: draft.fontMax,
        fontMax: draft.fontMax,
        letterboxMode: draft.letterboxMode,
      });
      showSuccess("Configuração da Faixa Salva Com Sucesso");
    } catch {
      toast.error("Falha ao salvar configuração");
    } finally {
      onDone();
    }
  };

  const doCancel = async () => {
    setCancelSpin(true);
    await new Promise((r) => setTimeout(r, 400));
    setDraft(settings);
    setCancelSpin(false);
    toast.message("Alterações revertidas");
  };

  return (
    <div className="premium-border p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" /> Configuração global da faixa
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={doCancel}
            disabled={!dirty || cancelSpin}
            className="flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/5 disabled:opacity-40"
          >
            {cancelSpin ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
            Cancelar
          </button>
          <button
            onClick={doSave}
            disabled={!dirty}
            className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold shadow-lg shadow-primary/30 disabled:opacity-40"
          >
            <Save className="h-3 w-3" /> Salvar
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Estas configurações se aplicam a todos os terminais simultaneamente. Clique em salvar para aplicar as alterações
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-5">
        {/* Controls */}
        <div className="space-y-4">
          {/* Altura em cm */}
          <div>
            <label className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Altura da faixa</span>
              <span className="font-mono text-foreground">{heightCm.toFixed(2)} cm ({draft.heightPx}px)</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min={TICKER_HEIGHT_MIN_CM} max={TICKER_HEIGHT_MAX_CM} step={0.1}
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <input
                type="number"
                min={TICKER_HEIGHT_MIN_CM} max={TICKER_HEIGHT_MAX_CM} step={0.1}
                value={Number(heightCm.toFixed(1))}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-20 rounded border bg-background px-2 py-1 text-xs text-center"
              />
              <span className="text-[10px] text-muted-foreground">cm</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Mín. {TICKER_HEIGHT_MIN_CM.toFixed(1)}cm · Máx. {TICKER_HEIGHT_MAX_CM.toFixed(1)}cm</p>
          </div>

          {/* Velocidade de rolagem */}
          <div>
            <label className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Velocidade de rolagem</span>
              <span className="font-mono text-foreground">{draft.scrollSpeed.toFixed(1)}×</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min={TICKER_SPEED_MIN} max={TICKER_SPEED_MAX} step={0.1}
                value={draft.scrollSpeed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <input
                type="number"
                min={TICKER_SPEED_MIN} max={TICKER_SPEED_MAX} step={0.1}
                value={Number(draft.scrollSpeed.toFixed(1))}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-20 rounded border bg-background px-2 py-1 text-xs text-center"
              />
              <span className="text-[10px] text-muted-foreground">×</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">1.0× = padrão · até {TICKER_SPEED_MAX.toFixed(1)}× (oito vezes mais rápido)</p>
          </div>

          {/* Tamanho do texto (manual, 12..24px) */}
          <div>
            <label className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Tamanho do texto</span>
              <span className="font-mono text-foreground">{draft.fontMax}px</span>
            </label>
            <select
              value={draft.fontMax}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full mt-1 rounded border bg-background px-2 py-2 text-sm"
            >
              {Array.from({ length: TICKER_FONT_MAX - TICKER_FONT_MIN + 1 }, (_, i) => TICKER_FONT_MIN + i).map((s) => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Tamanho fixo, global. Se o texto ficar apertado, aumente a altura da faixa.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Família de fonte</label>
              <select
                value={draft.fontFamily}
                onChange={(e) => setDraft((s) => ({ ...s, fontFamily: e.target.value }))}
                className="w-full mt-1 rounded border bg-background px-2 py-2 text-sm"
                style={{ fontFamily: draft.fontFamily }}
              >
                {FONT_FAMILIES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fundo da faixa</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={draft.bgColor} onChange={(e) => setDraft((s) => ({ ...s, bgColor: e.target.value }))} className="h-9 w-12 rounded border" />
                <div className="flex-1">
                  <input
                    type="range" min={0} max={1} step={0.05} value={draft.bgOpacity}
                    onChange={(e) => setDraft((s) => ({ ...s, bgOpacity: Number(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                  <p className="text-[10px] text-muted-foreground">Opacidade {Math.round(draft.bgOpacity * 100)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Letterbox toggle — global. When on: media respects proportion and ticker
              reserves its own strip. When off: media fills the screen and the ticker
              overlays on top of it (may overlap). */}
          <button
            type="button"
            onClick={() => setDraft((s) => ({ ...s, letterboxMode: !s.letterboxMode }))}
            className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${draft.letterboxMode ? "border-emerald-500/50 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"}`}
          >
            <span className="min-w-0">
              <span className="text-sm font-medium block">
                Letterbox {draft.letterboxMode ? "ativado" : "desativado"}
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {draft.letterboxMode
                  ? "Mantém proporção da mídia; a faixa reserva espaço e nunca sobrepõe o conteúdo."
                  : "Mídia preenche a tela na proporção original enviada; a faixa passa a sobrepor o conteúdo."}
              </span>
            </span>
            <span aria-checked={draft.letterboxMode} role="switch" data-on={draft.letterboxMode ? "true" : "false"} className="ccp-md-switch shrink-0">
              <span className="ccp-md-thumb">
                <Zap className="h-3 w-3" style={{ color: draft.letterboxMode ? "#16a34a" : "#dc2626" }} />
              </span>
            </span>
          </button>
        </div>

        {/* Live proportion ruler (updates instantly with slider/input) */}
        <RulerPreview heightCm={heightCm} bg={draft.bgColor} bgOpacity={draft.bgOpacity} />
      </div>
    </div>
  );
}

function RulerPreview({ heightCm, bg, bgOpacity }: { heightCm: number; bg: string; bgOpacity: number }) {
  // 1920x1080 canvas. cm are derived from actual pixels @ 96dpi.
  const CANVAS_CM = 1080 / PX_PER_CM;              // ≈ 28.575 cm
  const tickerPct = (heightCm / CANVAS_CM) * 100;  // % of canvas height
  const imgCm = CANVAS_CM - heightCm;
  const rgba = hexToRgba(bg, bgOpacity);

  // Live pixel values (dynamic — update with the slider in real time).
  const tickerPx = Math.round(heightCm * PX_PER_CM);
  const imgPx = 1080 - tickerPx;

  return (
    <div className="rounded-lg border border-white/10 bg-gradient-to-br from-black/60 to-zinc-900/60 p-3">
      <p className="text-[11px] uppercase tracking-widest text-white font-bold italic mb-2 flex items-center gap-1">
        <Eye className="h-3 w-3 text-amber-300" /> Proporção real (1920×1080)
      </p>
      <div className="flex items-stretch gap-3">
        {/* Canvas */}
        <div className="flex-1 aspect-video bg-black rounded-md overflow-hidden flex flex-col relative shadow-inner">
          <div className="ccp-prop-media flex-1 overflow-hidden">
            <img
              src={previewSample}
              alt="Conteúdo de exemplo"
              className="h-full w-full"
              style={{ objectFit: "cover", objectPosition: "center" }}
              loading="lazy"
            />
          </div>
          <div
            className="w-full flex items-center justify-center text-[10px] font-bold italic text-black/80 border-t border-black/20"
            style={{ height: `${tickerPct}%`, background: rgba }}
          >
            Faixa
          </div>
        </div>
        {/* Vertical ruler with cm labels — highlighted (bold + italic + accent color) */}
        <div className="flex flex-col justify-between text-[13px] min-w-[110px]">
          <div className="flex items-center gap-1.5 text-white">
            <span className="inline-block h-px w-3 bg-white/50" />
            <span className="italic font-bold text-white text-[14px]">Imagem</span>
          </div>
          <div className="flex-1 flex items-center">
            <div className="mr-2 h-full w-px bg-white/15" />
            <span className="font-mono italic font-bold text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.55)] text-[14px]">
              {imgCm.toFixed(1)} cm
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-px w-3 bg-white/50" />
            <span className="italic font-bold text-white text-[14px]">Faixa</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 h-4 w-px bg-amber-300" />
            <span className="font-mono italic font-bold text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.55)] text-[14px]">
              {heightCm.toFixed(2)} cm
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 flex items-center justify-center gap-2 text-[13px] text-white font-bold italic">
        <Eye className="h-3.5 w-3.5 text-amber-300" />
        <span>
          Imagem <b className="italic font-mono text-amber-300">1920×{imgPx}</b> · Faixa <b className="italic font-mono text-amber-300">1920×{tickerPx}</b>
        </span>
      </p>
      <p className="text-[10px] text-white/70 italic mt-1 text-center">
        Régua e pixels atualizam em tempo real. A prévia real só muda após <b className="text-white">Salvar</b>.
      </p>
    </div>
  );
}

function hexToRgba(hex: string, opacity: number): string {
  const c = hex.replace("#", "");
  const short = c.length === 3;
  const r = parseInt(short ? c[0] + c[0] : c.slice(0, 2), 16);
  const g = parseInt(short ? c[1] + c[1] : c.slice(2, 4), 16);
  const b = parseInt(short ? c[2] + c[2] : c.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/* ============================================================
   Material-style global visibility toggles (mutually exclusive)
   ============================================================ */
function GlobalVisibilityPanel({ settings, onProcessing, onDone }: GlobalPanelProps) {
  const apply = async (visibleAll: boolean) => {
    if (visibleAll === settings.visibleAll) return;
    const ok = await dialog.confirm({
      title: visibleAll ? "Exibir faixa em todos os terminais?" : "Retirar faixa de todos os terminais?",
      description: visibleAll
        ? "A faixa de notícias voltará a aparecer em todas as TVs conectadas."
        : "A faixa será removida imediatamente de todas as TVs. As mensagens continuam salvas.",
      confirmLabel: "Confirmar",
    });
    if (!ok) return;
    onProcessing(visibleAll ? "Ativando faixa em todos os terminais..." : "Removendo faixa de todos os terminais...");
    await new Promise((r) => setTimeout(r, SAVE_DELAY_MS));
    try {
      await updateTickerSettings({ visibleAll });
      showSuccess(visibleAll ? "Faixa Ativada em Todos os Terminais" : "Faixa Removida de Todos os Terminais");
    } catch {
      toast.error("Falha ao aplicar a mudança");
    } finally {
      onDone();
    }
  };

  return (
    <div className="premium-border p-4 space-y-3">
      <p className="text-sm font-semibold">Exibição global da faixa</p>
      <p className="text-xs text-muted-foreground">
        Controle único que liga ou desliga a faixa em <b>todos os terminais simultaneamente</b>.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MdSwitchRow
          label="Exibir Faixa em Todos os Terminais"
          on={settings.visibleAll}
          onClick={() => apply(true)}
        />
        <MdSwitchRow
          label="Retirar Faixa de Todos os Terminais"
          on={!settings.visibleAll}
          onClick={() => apply(false)}
        />
      </div>
    </div>
  );
}

function MdSwitchRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${on ? "border-emerald-500/50 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"}`}
    >
      <span className="text-sm font-medium">{label}</span>
      <span
        aria-checked={on}
        role="switch"
        data-on={on ? "true" : "false"}
        className="ccp-md-switch"
      >
        <span className="ccp-md-thumb">
          <Zap className="h-3 w-3" style={{ color: on ? "#16a34a" : "#dc2626" }} />
        </span>
      </span>
    </button>
  );
}

/* ============================================================
   Rich message editor — no font family / size (global-only now)
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
  const brushStyleRef = useRef<{ color?: string; bold?: boolean; italic?: boolean; underline?: boolean } | null>(null);

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
    if (s.color) exec("foreColor", rgbToHex(s.color));
    if (s.bold) exec("bold");
    if (s.italic) exec("italic");
    if (s.underline) exec("underline");
    setBrushArmed(false);
  };

  const plainLen = stripHtml(message.text).length;

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
          <p className="text-[10px] text-white/40 mt-0.5">
            Fonte e tamanho são definidos globalmente em <b>Configuração global da faixa</b>.
          </p>
          {/* Toolbar: only B / I / U / color / brush */}
          <div className="mt-1 flex flex-wrap items-center gap-1 rounded-t border border-white/10 bg-black/40 p-1.5">
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
            <label className="text-xs text-white/60">Cor da etiqueta / fundo da caixa</label>
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
            onClick={onSave}
            className="rounded-lg px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:brightness-110 flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
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