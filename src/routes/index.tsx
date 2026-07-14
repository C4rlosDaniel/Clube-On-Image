import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Lock, User, Monitor, LogIn, Zap, X } from "lucide-react";
import { useStore, setSession } from "@/lib/store";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import loginBg from "@/assets/login-bg.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — ClubeON CCP" },
      { name: "description", content: "Acesse o painel de transmissão digital ClubeON CCP." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { terminals } = useStore();
  const [mode, setMode] = useState<"admin" | "terminal">("admin");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const activeTerms = useMemo(() => terminals.filter((t) => t.active), [terminals]);
  const [termId, setTermId] = useState<string>("");
  const [err, setErr] = useState("");
  const [setDefault, setSetDefault] = useState(true);
  const [defaultId, setDefaultId] = useState<string | null>(null);

  // Auto-launch saved default terminal (skip with ?menu=1)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("ccp_default_terminal");
    setDefaultId(saved);
    const params = new URLSearchParams(window.location.search);
    if (saved && !params.has("menu")) {
      // wait until terminals loaded to validate
      const ok = terminals.find((t) => t.id === saved && t.active);
      if (ok) {
        setSession({ kind: "terminal", terminalId: saved });
        navigate({ to: "/terminal/$id", params: { id: saved } });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminals.length]);

  const handleAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (user === "Club" && pass === "@4922") {
      setSession({ kind: "admin" });
      navigate({ to: "/app/preview" });
    } else setErr("Credenciais inválidas.");
  };

  const handleTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termId) return setErr("Selecione um terminal.");
    if (setDefault) {
      localStorage.setItem("ccp_default_terminal", termId);
      toast.success("Atalho salvo: este dispositivo abrirá direto neste terminal.");
    }
    setSession({ kind: "terminal", terminalId: termId });
    navigate({ to: "/terminal/$id", params: { id: termId } });
  };

  const clearDefault = () => {
    localStorage.removeItem("ccp_default_terminal");
    setDefaultId(null);
    toast.success("Atalho removido.");
  };

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2 bg-[#0b0b0d] text-white">
      <div className="flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center md:justify-start">
            <div className="rounded-full bg-white p-2 shadow-2xl shadow-primary/30 ring-1 ring-white/10">
              <img src={logo} alt="Clube Pirassununga" className="h-20 w-20 object-contain" />
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-1">Faça seu login<span className="text-primary">.</span></h2>
          <p className="text-sm text-white/60 mb-8">Acesse como administrador ou entre como terminal de exibição.</p>

          <div className="flex gap-2 mb-6 rounded-lg p-1 ccp-login-card">
            <button onClick={() => { setMode("admin"); setErr(""); }} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${mode === "admin" ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"}`}>
              Administrador
            </button>
            <button onClick={() => { setMode("terminal"); setErr(""); }} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${mode === "terminal" ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"}`}>
              Terminal
            </button>
          </div>

          {defaultId && (
            <div className="mb-4 flex items-center justify-between gap-2 rounded-lg ccp-login-card px-3 py-2 text-xs">
              <span className="flex items-center gap-2 text-white/70"><Zap className="h-3.5 w-3.5 text-primary" /> Atalho ativo neste dispositivo</span>
              <button onClick={clearDefault} className="flex items-center gap-1 text-white/60 hover:text-white"><X className="h-3 w-3" /> Remover</button>
            </div>
          )}

          {mode === "admin" ? (
            <form onSubmit={handleAdmin} className="space-y-5 ccp-login-card p-6">
              <div>
                <label className="block text-sm mb-2">Usuário</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input value={user} onChange={(e) => setUser(e.target.value)} className="w-full rounded-md bg-white/5 border border-white/10 py-3 pl-10 pr-4 outline-none focus:border-primary transition" placeholder="Usuário" autoComplete="username" />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-2">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="w-full rounded-md bg-white/5 border border-white/10 py-3 pl-10 pr-4 outline-none focus:border-primary" placeholder="••••" />
                </div>
              </div>
              {err && <p className="text-sm text-primary">{err}</p>}
              <button type="submit" className="ccp-login-btn w-full rounded-md bg-primary hover:bg-[oklch(0.5_0.2_27)] py-3 font-semibold flex items-center justify-center gap-2">
                <LogIn className="h-4 w-4" /> Entrar
              </button>
            </form>
          ) : (
            <form onSubmit={handleTerminal} className="space-y-5 ccp-login-card p-6">
              <div>
                <label className="block text-sm mb-2">Selecione o terminal</label>
                <div className="relative">
                  <Monitor className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <select value={termId} onChange={(e) => setTermId(e.target.value)} className="w-full appearance-none rounded-md bg-white/5 border border-white/10 py-3 pl-10 pr-4 outline-none focus:border-primary">
                    <option value="" className="bg-[#0b0b0d]">— escolher —</option>
                    {activeTerms.map((t) => (
                      <option key={t.id} value={t.id} className="bg-[#0b0b0d]">{t.name}</option>
                    ))}
                  </select>
                </div>
                {activeTerms.length === 0 && (
                  <p className="mt-2 text-xs text-white/50">Nenhum terminal cadastrado. Entre como administrador para criar.</p>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none rounded-md border border-white/10 bg-white/[0.03] p-3 hover:border-white/30 transition">
                <input type="checkbox" checked={setDefault} onChange={(e) => setSetDefault(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                <span className="text-xs leading-relaxed">
                  <span className="font-medium block">Definir este terminal como padrão deste dispositivo</span>
                  <span className="text-white/50">Da próxima vez, o app abrirá direto na exibição em tela cheia. (use <code>?menu=1</code> para retornar a esta tela)</span>
                </span>
              </label>

              {err && <p className="text-sm text-primary">{err}</p>}
              <button type="submit" className="ccp-login-btn w-full rounded-md bg-primary hover:bg-[oklch(0.5_0.2_27)] py-3 font-semibold flex items-center justify-center gap-2">
                <Monitor className="h-4 w-4" /> Entrar como Terminal
              </button>
            </form>
          )}
        </div>
      </div>
      <div className="hidden md:block relative">
        <img src={loginBg} alt="Clube Pirassununga" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/40 to-[#0b0b0d]" />
        <div className="absolute bottom-8 left-8 right-8 text-right">
          <p className="text-xs uppercase tracking-widest text-white/60">Clube Pirassununga · 1928</p>
          <p className="text-lg font-semibold">Sistema oficial de transmissão</p>
        </div>
      </div>
    </div>
  );
}
