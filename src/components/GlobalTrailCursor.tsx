import React, { useEffect, useRef } from 'react';

export function GlobalTrailCursor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    let mouseX = -1000;
    let mouseY = -1000;
    let isActive = false;

    // Buffer of historic trailing segments
    const trail: { x: number; y: number; age: number; maxAge: number }[] = [];

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleGlobalMouse = (e: any) => {
      const detail = e.detail || {};
      mouseX = detail.x;
      mouseY = detail.y;
      isActive = detail.active !== false;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('globalroomiamouse', handleGlobalMouse);

    let animationFrameId: number;

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      // Add a segment to the trail on each tick if mouse is within screen
      if (isActive && mouseX > -500 && mouseY > -500) {
        trail.push({
          x: mouseX,
          y: mouseY,
          age: 0,
          maxAge: 24, // Fades out progressively over 24 frames
        });
      }

      // Limit trail size
      if (trail.length > 50) {
        trail.shift();
      }

      // Update and draw segments
      for (let i = trail.length - 1; i >= 0; i--) {
        const pt = trail[i];
        pt.age += 1;

        if (pt.age > pt.maxAge) {
          trail.splice(i, 1);
          continue;
        }

        const lifeRatio = 1 - pt.age / pt.maxAge; // 1 -> 0
        // Shrink trail diameter towards the tip and end
        const radius = (18 * lifeRatio) + 4; // Max 22px fading to 4px
        const opacity = lifeRatio * 0.22; // Progressive fade out

        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
        // Clean high-tech teal/emerald color palette matching Roomia's design
        grad.addColorStop(0, `rgba(20, 184, 166, ${opacity})`);
        grad.addColorStop(0.4, `rgba(20, 184, 166, ${opacity * 0.45})`);
        grad.addColorStop(1, 'rgba(20, 184, 166, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw client light connection lines occasionally for an advanced technical vibe (subtle)
      if (trail.length > 2) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(20, 184, 166, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 1; i < trail.length; i++) {
          ctx.lineTo(trail[i].x, trail[i].y);
        }
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('globalroomiamouse', handleGlobalMouse);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-screen h-screen pointer-events-none z-40 select-none mix-blend-screen"
      style={{ pointerEvents: 'none' }}
    />
  );
}
