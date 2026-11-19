/**
 * Avisos de la interfaz (los "toasts"). Un solo canal para toda la plataforma:
 *
 *   notify.success('Reserva confirmada');
 *   notify.error('No pudimos guardar los cambios. Inténtalo de nuevo.');
 *
 * El color y el ícono los decide el TIPO de aviso, no el texto: no hace falta poner emojis.
 * Los avisos se muestran con <ToastHost /> (src/components/ui/Toast.tsx).
 */
export type NoticeTone = 'success' | 'warning' | 'error' | 'info';

export interface Notice {
  id: string;
  tone: NoticeTone;
  message: string;
}

type Listener = (notice: Notice) => void;

const listeners = new Set<Listener>();
let sequence = 0;

/** Quita emojis y espacios del inicio: el tipo de aviso ya lo dice */
export const cleanNoticeText = (text: string): string =>
  String(text ?? '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();

function emit(tone: NoticeTone, message: string) {
  const text = cleanNoticeText(message);
  if (!text) return;
  sequence += 1;
  const notice: Notice = { id: `aviso-${sequence}`, tone, message: text };
  listeners.forEach(listener => listener(notice));
}

export const notify = {
  success: (message: string) => emit('success', message),
  warning: (message: string) => emit('warning', message),
  error: (message: string) => emit('error', message),
  info: (message: string) => emit('info', message),
  /** Para `window.alert`: toma el tipo del emoji inicial si lo trae */
  auto: (message: string) => {
    const text = String(message ?? '');
    if (text.startsWith('✅')) return emit('success', text);
    if (text.startsWith('❌')) return emit('error', text);
    if (text.startsWith('⚠')) return emit('warning', text);
    return emit('info', text);
  }
};

export function subscribeNotices(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
