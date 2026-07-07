import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

type Props = {
  show: boolean;
  label?: string;
  sublabel?: string;
  durationMs?: number;
};

/**
 * Full-screen blocking loader used for actions that must not be interrupted
 * (message save, ticker settings save, library add/delete). Matches the
 * style of the terminal presentation-swap loader.
 */
export function BlockingLoader({ show, label, sublabel, durationMs = 6000 }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md"
          // block interaction
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="w-[min(92vw,380px)] rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 text-white shadow-2xl p-7 flex flex-col items-center gap-4"
          >
            <div className="rounded-full bg-primary/15 p-4">
              <Loader2 className="h-9 w-9 animate-spin text-primary" />
            </div>
            <p className="text-base font-semibold">{label ?? "Processando..."}</p>
            {sublabel && <p className="text-xs text-white/60 text-center">{sublabel}</p>}
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: durationMs / 1000, ease: "linear" }}
                className="h-full bg-primary"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}