import React, { useEffect, useRef, useState } from 'react';

export interface InteractiveContainerProps {
  id?: string;
  as?: 'header' | 'section' | 'footer' | 'div' | 'main';
  className?: string;
  children: React.ReactNode;
}

// Global mouse position broadcaster to maintain 100% continuous cursor tracking
if (typeof window !== 'undefined' && !(window as any).__roomiaGlobalMouseSetup) {
  (window as any).__roomiaGlobalMouseSetup = true;

  const handleGlobalMouseMove = (e: MouseEvent) => {
    (window as any).__roomiaLastGlobalCoords = { x: e.clientX, y: e.clientY, active: true };
    window.dispatchEvent(new CustomEvent('globalroomiamouse', {
      detail: { x: e.clientX, y: e.clientY, active: true }
    }));
  };

  const handleGlobalMouseLeave = () => {
    (window as any).__roomiaLastGlobalCoords = { x: -1000, y: -1000, active: false };
    window.dispatchEvent(new CustomEvent('globalroomiamouse', {
      detail: { x: -1000, y: -1000, active: false }
    }));
  };

  window.addEventListener('mousemove', handleGlobalMouseMove);
  document.addEventListener('mouseleave', handleGlobalMouseLeave);
}

export function InteractiveContainer({
  id,
  as: Component = 'section',
  className = "",
  children
}: InteractiveContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleMouseUpdate = (e: Event) => {
      if (!containerRef.current) return;
      const customEvent = e as CustomEvent;
      const { x, y, active } = customEvent.detail || {};

      if (!active || x < 0 || y < 0) {
        setIsHovered(false);
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const inside = (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      );

      setIsHovered(inside);
      if (inside) {
        setCoords({
          x: x - rect.left,
          y: y - rect.top
        });
      }
    };

    // Retrieve initial coords if mouse is already active
    const initialCoords = (window as any).__roomiaLastGlobalCoords;
    if (initialCoords && initialCoords.active && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const inside = (
        initialCoords.x >= rect.left &&
        initialCoords.x <= rect.right &&
        initialCoords.y >= rect.top &&
        initialCoords.y <= rect.bottom
      );
      setIsHovered(inside);
      if (inside) {
        setCoords({
          x: initialCoords.x - rect.left,
          y: initialCoords.y - rect.top
        });
      }
    }

    window.addEventListener('globalroomiamouse', handleMouseUpdate);
    return () => {
      window.removeEventListener('globalroomiamouse', handleMouseUpdate);
    };
  }, []);

  return (
    <Component
      id={id}
      ref={containerRef}
      className={`relative overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* Discreet static grid dots / squares */}
      <div
        className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:4rem_4rem] z-0"
      />

      {/* Mouse silhouette highlighting overlay: lights up the grid where the cursor resides */}
      {isHovered && (
        <div
          className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(20,184,166,0.65)_1px,transparent_1px),linear-gradient(to_bottom,rgba(20,184,166,0.65)_1px,transparent_1px)] bg-[size:4rem_4rem] z-0"
          style={{
            // Mask radius is reduced by 50% (from 220px to 110px) to make the cursor silhouette smaller and cleaner
            maskImage: `radial-gradient(110px circle at ${coords.x}px ${coords.y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)`,
            WebkitMaskImage: `radial-gradient(110px circle at ${coords.x}px ${coords.y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)`
          }}
        />
      )}

      {/* Mouse subtle center glow light (also shrunk by 50% and made warmer and tighter) */}
      {isHovered && (
        <div
          className="absolute pointer-events-none rounded-full blur-[60px] bg-teal-500/15 z-0"
          style={{
            width: '130px',
            height: '130px',
            left: `${coords.x - 65}px`,
            top: `${coords.y - 65}px`,
            transform: 'translate3d(0, 0, 0)',
          }}
        />
      )}

      {/* Foreground Content */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </Component>
  );
}
