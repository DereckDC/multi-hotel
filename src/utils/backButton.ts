// Botón "atrás" de Android en el APK. Sin esto, con un menú o una ventana abierta, "atrás" no la
// cerraba: la app volvía de página o se cerraba. Cada menú, hoja o ventana abierta se registra con
// useBackHandler; "atrás" cierra la última que se abrió. Si no hay ninguna, vuelve de página y,
// en la primera pantalla, deja la app en segundo plano (no la cierra).
import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { isNativeApp } from './platform';

const handlers: Array<() => void> = [];

export function initBackButton() {
  if (!isNativeApp()) return;
  App.addListener('backButton', ({ canGoBack }) => {
    const last = handlers[handlers.length - 1];
    if (last) {
      last();
      return;
    }
    if (canGoBack) window.history.back();
    else App.minimizeApp().catch(() => {});
  }).catch(() => {});
}

/** Mientras `active` sea verdadero, el botón "atrás" de Android ejecuta `onBack` (por ejemplo, cerrar el menú) */
export function useBackHandler(active: boolean, onBack: () => void) {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (!active) return;
    const handler = () => latest.current();
    handlers.push(handler);
    return () => {
      const index = handlers.lastIndexOf(handler);
      if (index >= 0) handlers.splice(index, 1);
    };
  }, [active]);
}
