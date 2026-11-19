import { useRef, type TouchEvent } from 'react';

/**
 * Deslizar con el dedo a la izquierda o a la derecha (galerías de fotos en el teléfono).
 *
 *   const swipe = useSwipe(siguiente, anterior);
 *   <div {...swipe.handlers} onClick={() => { if (swipe.consumeSwipe()) return; abrir(); }}>
 *
 * Solo cuenta como deslizamiento un movimiento mayormente horizontal, así el desplazamiento vertical
 * de la página sigue funcionando. `consumeSwipe` evita que el toque final abra la foto en grande.
 */
export function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void, threshold = 40) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  return {
    handlers: {
      onTouchStart: (event: TouchEvent) => {
        const touch = event.touches[0];
        start.current = { x: touch.clientX, y: touch.clientY };
        swiped.current = false;
      },
      onTouchEnd: (event: TouchEvent) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - from.x;
        const dy = touch.clientY - from.y;
        if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        swiped.current = true;
        if (dx < 0) onSwipeLeft();
        else onSwipeRight();
      }
    },
    /** true si el último toque fue un deslizamiento (y lo olvida) */
    consumeSwipe: () => {
      const was = swiped.current;
      swiped.current = false;
      return was;
    }
  };
}
