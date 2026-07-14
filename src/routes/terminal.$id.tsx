import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Pin, PinOff } from "lucide-react";
import { useStore, setSession } from "@/lib/store";
import { PresentationPlayer } from "@/components/PresentationPlayer";
import logo from "@/assets/logo.png";
import { toast } from "sonner";

export const Route = createFileRoute("/terminal/$id")({ component: TerminalScreen });

function TerminalScreen() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { terminals } = useStore();
  const terminal = terminals.find((t) => t.id === id);
  const [showUI, setShowUI] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPinned(localStorage.getItem("ccp_default_terminal") === id);
  }, [id]);
  // refreshToken from realtime triggers re-mount of the player
  const tick = `${terminal?.presentationId ?? ""}::${terminal?.refreshToken ?? 0}`;

  useEffect(() => {
    let timeout: number | undefined;
    const show = () => {
      setShowUI(true);
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setShowUI(false), 2500);
    };
    window.addEventListener("mousemove", show);
    window.addEventListener("touchstart", show);
    return () => {
      window.removeEventListener("mousemove", show);
      window.removeEventListener("touchstart", show);
      if (timeout) window.clearTimeout(timeout);
    };
  }, []);

  // Auto-fullscreen when launched as the device's default terminal
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isDefault = localStorage.getItem("ccp_default_terminal") === id;
    if (!isDefault) return;
    const tryFs = async () => {
      try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch {}
    };
    tryFs();
    const once = () => { tryFs(); window.removeEventListener("click", once); window.removeEventListener("keydown", once); };
    window.addEventListener("click", once);
    window.addEventListener("keydown", once);
    return () => { window.removeEventListener("click", once); window.removeEventListener("keydown", once); };
  }, [id]);

  const toggleFs = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  };

  const exit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setSession(null);
    nav({ to: "/" });
  };

  const togglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinned) {
      localStorage.removeItem("ccp_default_terminal");
      setPinned(false);
      toast.success("Terminal desafixado deste dispositivo");
    } else {
      localStorage.setItem("ccp_default_terminal", id);
      setPinned(true);
      toast.success("Terminal fixado como padrão deste dispositivo");
    }
  };

  if (!terminal) {
    return (
      <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <p>Terminal não encontrado</p>
        <button onClick={() => nav({ to: "/" })} className="rounded bg-primary px-4 py-2">Voltar</button>
      </div>
    );
  }

  return (
    <div onClick={toggleFs} className="h-screen w-screen bg-black overflow-hidden cursor-pointer relative">
      <PresentationPlayer key={tick} presentationId={terminal.presentationId} />

      {/* Marca d'água: somente o logo */}
      <div className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-white/90 p-1 shadow-lg opacity-70">
        <img src={logo} alt="Clube Pirassununga" className="h-7 w-7 object-contain" />
      </div>

      <div className={`absolute top-0 left-0 right-0 p-4 flex justify-between items-center transition-opacity duration-300 ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="flex items-center gap-2 rounded-full bg-black/60 text-white pl-1 pr-3 py-1 text-xs backdrop-blur">
          <span className="rounded-full bg-white p-0.5"><img src={logo} alt="" className="h-5 w-5 object-contain" /></span>
          <span className="font-semibold">{terminal.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exit} className="flex items-center gap-2 rounded-full bg-black/60 hover:bg-primary text-white px-3 py-1.5 text-xs backdrop-blur transition">
            <LogOut className="h-3 w-3" /> Sair do Terminal
          </button>
          <button onClick={togglePin} className={`flex items-center gap-2 rounded-full text-white px-3 py-1.5 text-xs backdrop-blur transition ${pinned ? "bg-primary/80 hover:bg-primary" : "bg-black/60 hover:bg-primary"}`}>
            {pinned ? <><PinOff className="h-3 w-3" /> Desafixar este Terminal</> : <><Pin className="h-3 w-3" /> Fixar este Terminal</>}
          </button>
        </div>
      </div>

      {!terminal.presentationId && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="mx-auto mb-5 inline-flex rounded-full bg-white p-3 opacity-80">
              <img src={logo} alt="" className="h-24 w-24 object-contain" />
            </div>
            <p className="text-sm text-white/60">Nenhuma apresentação vinculada</p>
            <p className="text-xs mt-1 text-white/40">Atribua uma apresentação no painel administrativo.</p>
          </div>
        </div>
      )}
    </div>
  );
}