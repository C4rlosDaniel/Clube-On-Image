import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus, Trash2, Pencil, Check, X, AlertTriangle, ArrowUp, ArrowDown,
  Power, Megaphone,
} from "lucide-react";
import {
  useStore,
  createTickerMessage,
  updateTickerMessage,
  deleteTickerMessage,
  reorderTickerMessages,
  type TickerMessage,
} from "@/lib/store";
import { dialog } from "@/components/PremiumDialog";
import { TickerBar } from "@/components/TickerBar";
import { toast } from "sonner";

export const Route = createFileRoute("/app/news")({ component: NewsPage });

const LABEL_PRESETS = ["AVISO", "URGENTE", "EVENTO", "INSTITUCIONAL", "CLUBE PIRASSUNUNGA"];
const COLOR_PRESETS = ["#dc2626", "#ea580c", "#0369a1", "#166534", "#111827"];

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
  const { tickerMessages, terminals } = useStore();
  const [editing, setEditing] = useState<TickerMessage | null>(null);
  const [creating, setCreating] = useState(false);

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
      text: "",
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
    if (!m.text.trim()) { toast.error("Escreva o texto da mensagem"); return; }
    if (creating) {
      await createTickerMessage({
        text: m.text.trim(),
        label: m.label, color: m.color, priority: m.priority, active: m.active,
        startsAt: m.startsAt, endsAt: m.endsAt, terminalIds: m.terminalIds,
      });
      toast.success("Mensagem publicada em tempo real");
    } else {
      await updateTickerMessage(m.id, {
        text: m.text.trim(), label: m.label, color: m.color, priority: m.priority, active: m.active,
        startsAt: m.startsAt, endsAt: m.endsAt, terminalIds: m.terminalIds,
      });
      toast.success("Mensagem atualizada");
    }
    setEditing(null); setCreating(false);
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
        <button onClick={openNew} className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Nova Mensagem
        </button>
      </div>

      {/* Live preview strip */}
      <div className="relative h-24 rounded-xl overflow-hidden premium-border bg-black">
        <div className="absolute inset-0 flex items-center justify-center text-white/40 text-xs uppercase tracking-widest">
          Pré-visualização ao vivo
        </div>
        <TickerBar />
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
                <p className="truncate text-sm">{m.text}</p>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => { setEditing(null); setCreating(false); }}>
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 text-white shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{creating ? "Nova mensagem" : "Editar mensagem"}</h3>
              <button onClick={() => { setEditing(null); setCreating(false); }} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <div>
              <label className="text-xs text-white/60">Texto da mensagem</label>
              <textarea
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                rows={3}
                className="w-full mt-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm"
                placeholder="Ex: Piscina fechada para manutenção nesta sexta-feira."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">Etiqueta</label>
                <input
                  list="ticker-labels"
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value.toUpperCase() })}
                  className="w-full mt-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm uppercase"
                />
                <datalist id="ticker-labels">
                  {LABEL_PRESETS.map((l) => <option key={l} value={l} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs text-white/60">Cor da etiqueta</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="h-9 w-12 rounded border border-white/10 bg-black/40" />
                  <div className="flex gap-1">
                    {COLOR_PRESETS.map((c) => (
                      <button key={c} onClick={() => setEditing({ ...editing, color: c })} className="h-6 w-6 rounded-full border border-white/20" style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.checked })} className="h-4 w-4 accent-primary" />
                Urgente / prioridade
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="h-4 w-4 accent-primary" />
                Ativa
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">Início (opcional)</label>
                <input type="datetime-local" value={toLocalInput(editing.startsAt)} onChange={(e) => setEditing({ ...editing, startsAt: fromLocalInput(e.target.value) })} className="w-full mt-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-white/60">Expiração (opcional)</label>
                <input type="datetime-local" value={toLocalInput(editing.endsAt)} onChange={(e) => setEditing({ ...editing, endsAt: fromLocalInput(e.target.value) })} className="w-full mt-1 rounded border border-white/10 bg-black/40 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">Terminais</label>
              <p className="text-[11px] text-white/40 mb-1">Deixe tudo desmarcado para exibir em <b>todos os terminais</b>.</p>
              <div className="max-h-40 overflow-auto rounded border border-white/10 bg-black/30 p-2 space-y-1">
                {terminals.length === 0 && <p className="text-xs text-white/40">Nenhum terminal cadastrado.</p>}
                {terminals.map((t) => {
                  const checked = editing.terminalIds.includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const set = new Set(editing.terminalIds);
                          if (e.target.checked) set.add(t.id); else set.delete(t.id);
                          setEditing({ ...editing, terminalIds: Array.from(set) });
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
              <button onClick={() => { setEditing(null); setCreating(false); }} className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5">Cancelar</button>
              <button onClick={() => save(editing)} className="rounded-lg px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:brightness-110 flex items-center gap-2">
                <Check className="h-4 w-4" /> {creating ? "Publicar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}