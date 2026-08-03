import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Undo2 } from "lucide-react";

type Toast = {
  id: number;
  text: string;
  undo?: () => void | Promise<void>;
};

const listeners = new Set<(t: Toast) => void>();
let seq = 0;

export function showSuccess(text: string, opts?: { undo?: () => void | Promise<void> }) {
  const t: Toast = { id: ++seq, text, undo: opts?.undo };
  listeners.forEach((l) => l(t));
}

export function SuccessNeonHost() {
  const [items, setItems] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const l = (t: Toast) => {
      setItems((prev) => [...prev, t]);
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed top-6 right-6 z-[200] flex flex-col gap-3">
      {items.map((t) => (
        <div key={t.id} className="ccp-success-neon pointer-events-auto flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl text-white font-semibold text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="whitespace-nowrap">{t.text}</span>
          {t.undo && (
            <button
              onClick={() => {
                setItems((prev) => prev.filter((x) => x.id !== t.id));
                void t.undo!();
              }}
              className="ml-2 flex items-center gap-1 rounded-md bg-white/15 hover:bg-white/25 px-2 py-1 text-xs font-medium transition"
            >
              <Undo2 className="h-3 w-3" /> Desfazer
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}