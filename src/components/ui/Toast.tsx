import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { subscribeNotices, type Notice, type NoticeTone } from '../../utils/notify';

const TONES: Record<NoticeTone, { Icon: typeof Info; bar: string; icon: string }> = {
  success: { Icon: CheckCircle2, bar: 'bg-success-600', icon: 'text-success-600' },
  warning: { Icon: AlertTriangle, bar: 'bg-warning-600', icon: 'text-warning-600' },
  error: { Icon: XCircle, bar: 'bg-danger-600', icon: 'text-danger-600' },
  info: { Icon: Info, bar: 'bg-brand-cyan', icon: 'text-brand-cyan' }
};

/** Cuánto dura cada aviso en pantalla (los de error, un poco más) */
const DURATION_MS: Record<NoticeTone, number> = { success: 4500, info: 4500, warning: 6000, error: 7000 };
const MAX_VISIBLE = 4;

/** Muestra los avisos de notify.*; se coloca una sola vez en App.tsx */
export function ToastHost() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    return subscribeNotices(notice => {
      setNotices(prev => {
        // Mismo aviso ya visible: no se repite
        if (prev.some(n => n.tone === notice.tone && n.message === notice.message)) return prev;
        return [...prev, notice].slice(-MAX_VISIBLE);
      });
      window.setTimeout(() => {
        setNotices(prev => prev.filter(n => n.id !== notice.id));
      }, DURATION_MS[notice.tone]);
    });
  }, []);

  const dismiss = (id: string) => setNotices(prev => prev.filter(n => n.id !== id));

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-3 right-3 z-toast flex flex-col gap-2.5 sm:bottom-6 sm:left-auto sm:right-6 sm:w-full sm:max-w-sm print:hidden"
      style={{ marginBottom: 'var(--safe-bottom)' }}
    >
      <AnimatePresence>
        {notices.map(notice => {
          const { Icon, bar, icon } = TONES[notice.tone];
          return (
            <motion.div
              key={notice.id}
              role={notice.tone === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 pl-5 shadow-xl"
            >
              <span className={`absolute inset-y-0 left-0 w-1.5 ${bar}`} aria-hidden="true" />
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} aria-hidden="true" />
              <p className="flex-1 text-sm font-medium leading-relaxed text-neutral-800">{notice.message}</p>
              <button
                type="button"
                onClick={() => dismiss(notice.id)}
                aria-label="Cerrar aviso"
                className="shrink-0 rounded-lg p-0.5 text-neutral-400 transition-colors hover:text-neutral-700 focus-brand"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
