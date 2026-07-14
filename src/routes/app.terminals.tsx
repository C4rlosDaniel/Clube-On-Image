import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, RefreshCw, ExternalLink, Power, Pencil, Check, X, Loader2 } from "lucide-react";
import { useStore, createTerminal, updateTerminal, deleteTerminal, pingTerminal } from "@/lib/store";
import { dialog } from "@/components/PremiumDialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/app/terminals")({ component: Terms });

function Terms() {
  const { terminals, presentations } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [swap, setSwap] = useState<{ termId: string; newPresId: string | null; oldPresId: string | null } | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [phase, setPhase] = useState<string>("");

  const handleNew = async () => {
    const name = await dialog.prompt({
      title: "Novo Terminal",
      description: "Crie uma nova tela para receber transmissões.",
      placeholder: "Ex: TV Recepção",
      confirmLabel: "Criar",
    });
    if (name) { await createTerminal(name); toast.success("Terminal criado e sincronizado"); }
  };

  const openTerminal = (id: string) => {
    window.open(`/terminal/${id}`, "_blank", "noopener");
  };

  const confirmSwap = async () => {
    if (!swap) return;
    setSwapping(true);
    try {
      setPhase("Preparando cache...");
      await new Promise((r) => setTimeout(r, 1500));
      setPhase("Validando arquivos...");
      await new Promise((r) => setTimeout(r, 1500));
      setPhase("Sincronizando com servidor...");
      await updateTerminal(swap.termId, { presentationId: swap.newPresId });
      await new Promise((r) => setTimeout(r, 1500));
      setPhase("Aplicando nos players conectados...");
      await pingTerminal(swap.termId);
      await new Promise((r) => setTimeout(r, 1500));
      toast.success("Apresentação aplicada em todos os players");
    } catch {
      toast.error("Falha ao trocar apresentação");
    } finally {
      setSwapping(false);
      setPhase("");
      setSwap(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Atribuições aos Terminais</h1>
          <p className="text-sm text-muted-foreground">Vincule apresentações às telas e sincronize em tempo real.</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo Terminal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {terminals.map((t) => {
          const pres = presentations.find((p) => p.id === t.presentationId);
          return (
            <div key={t.id} className="premium-border p-5 space-y-4 ccp-anim-slide">
              <div className="flex items-start justify-between gap-2">
                {editing === t.id ? (
                  <div className="flex gap-1 items-center flex-1">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 rounded border px-2 py-1 text-sm" />
                    <button onClick={async () => { await updateTerminal(t.id, { name: editName }); setEditing(null); }} className="p-1 text-primary"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{t.name}</h3>
                      <button onClick={() => { setEditing(t.id); setEditName(t.name); }} className="text-muted-foreground"><Pencil className="h-3 w-3" /></button>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ID: {t.id.slice(0, 8)}</p>
                  </div>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.active ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
                  {t.active ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Apresentação vinculada</label>
                <select
                  value={t.presentationId ?? ""}
                  onChange={(e) => {
                    const newId = e.target.value || null;
                    if (newId === t.presentationId) return;
                    setSwap({ termId: t.id, newPresId: newId, oldPresId: t.presentationId });
                  }}
                  className="w-full mt-1 rounded border bg-background px-3 py-2 text-sm"
                >
                  <option value="">— nenhuma —</option>
                  {presentations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Resolução:</span> {t.resolution}</div>
                <div><span className="text-muted-foreground">Sync:</span> {new Date(t.lastSync).toLocaleTimeString()}</div>
              </div>
              <p className="text-xs text-muted-foreground truncate">Mídias: {pres ? pres.mediaIds.length : 0}</p>

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => openTerminal(t.id)} className="flex-1 flex items-center justify-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium">
                  <ExternalLink className="h-3 w-3" /> Abrir
                </button>
                <button onClick={() => pingTerminal(t.id)} className="flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs font-medium hover:bg-accent">
                  <RefreshCw className="h-3 w-3" /> Atualizar
                </button>
                <button onClick={() => updateTerminal(t.id, { active: !t.active })} className="flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-xs">
                  <Power className="h-3 w-3" />
                </button>
                <button onClick={async () => { if (await dialog.confirm({ title: "Excluir terminal?", description: "A tela vinculada será desconectada.", confirmLabel: "Excluir", destructive: true })) { await deleteTerminal(t.id); toast.success("Terminal excluído"); } }} className="flex items-center justify-center gap-1 rounded-md border border-destructive/40 text-destructive px-3 py-2 text-xs">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {swap && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
            onClick={() => !swapping && setSwap(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 text-white shadow-2xl p-6"
            >
              <h3 className="text-lg font-semibold tracking-tight">Trocar apresentação?</h3>
              <p className="mt-1 text-sm text-white/60">
                Deseja realmente substituir a apresentação atual deste terminal? Todos os players conectados serão atualizados automaticamente.
              </p>
              {swapping && (
                <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-sm font-medium">{phase}</p>
                  </div>
                  <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 6, ease: "linear" }} className="h-full bg-primary" />
                  </div>
                </div>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setSwap(null)} disabled={swapping} className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-40">Cancelar</button>
                <button onClick={confirmSwap} disabled={swapping} className="rounded-lg px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:brightness-110 disabled:opacity-60 flex items-center gap-2">
                  {swapping && <Loader2 className="h-4 w-4 animate-spin" />}
                  {swapping ? "Trocando..." : "Trocar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}