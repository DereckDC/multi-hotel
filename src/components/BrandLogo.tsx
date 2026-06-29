import React, { useState } from 'react';
import RoomiaLogo from '../RoomiaPMSLogoSinFondo.png';

// Official local static asset imported to allow Vite compilation
export const OFFICIAL_LOGO_URL = RoomiaLogo;

// Remote backup URL using high-performance vector SVG to prevent external CDN decay
export const BACKUP_LOGO_URL = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4gPHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyMCIgZmlsbD0iIzA3MTcyNiIvPiA8Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjNCNEU2IiBzdHJva2Utd2lkdGg9IjMiIG9wYWNpdHk9IjAuNCIvPiA8ZyBzdHJva2U9IiMyM0I0RTYiIHN0cm9rZS13aWR0aD0iNC41IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPiA8cGF0aCBkPSJNNDAgMzAgSDU1IEM2NSAzMCwgNjUgNDYsIDU1IDQ2IEg0MCBaIi8+IDxwYXRoIGQ9Ik00MCA0NiBMNjAgNzAiLz4gPHBhdGggZD0iTTQwIDI0IFY3MCIvPiA8cGF0aCBkPSJNNTAgMjAgQzMzIDIwLCAyMCAzMywgMjAgNTAgQzIwIDY3LCAzMyA4MCwgNTAgODAgQzY3IDgwLCA4MCA2NywgODAgNTAiIG9wYWNpdHk9IjAuNiIvPiA8cGF0aCBkPSJNNjQgMzYgQzY4IDQwLCA3MCA0NSwgNzAgNTAgQzcwIDYxLCA2MSA3MCwgNTAgNzAiIG9wYWNpdHk9IjAuOCIgc3Ryb2tlLXdpZHRoPSIzIi8+IDwvZz4gPC9zdmc+";

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  lightText?: boolean;
}

export function BrandLogo({ size = 'md', showText = false, lightText = false }: BrandLogoProps) {
  const [logoSource, setLogoSource] = useState<'local' | 'backup' | 'svg'>('local');

  // Fallback SVG of the intricate interlocking R shape if CDN block occurred
  const renderFallbackSvg = (dimensions: string) => (
    <svg 
      viewBox="0 0 100 100" 
      className={`${dimensions} text-brand-cyan fill-current`}
      role="img"
      aria-label="Roomia Mono Logo"
    >
      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-40" />
      <g stroke="currentColor" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Intricate interwoven vector representing the luxury braided monogram 'R' */}
        <path d="M40 30 H55 C65 30, 65 46, 55 46 H40 Z" />
        <path d="M40 46 L60 70" />
        <path d="M40 24 V70" />
        <path d="M50 20 C33 20, 20 33, 20 50 C20 67, 33 80, 50 80 C67 80, 80 67, 80 50" className="opacity-60" />
        <path d="M64 36 C68 40, 70 45, 70 50 C70 61, 61 70, 50 70" className="opacity-80" strokeWidth="3" />
      </g>
    </svg>
  );

  let iconSizeClass = "w-9 h-9 rounded-xl";
  let textSizeClass = "text-neutral-200 text-xs leading-none";
  let letterSize = "w-9 h-9";

  if (size === 'sm') {
    iconSizeClass = "w-6 h-6 rounded-lg";
    textSizeClass = "text-[9px] leading-none";
    letterSize = "w-6 h-6";
  } else if (size === 'lg') {
    iconSizeClass = "w-12 h-12 rounded-2xl";
    textSizeClass = "text-[18px] leading-[18px]";
    letterSize = "w-12 h-12";
  } else if (size === 'xl') {
    iconSizeClass = "w-20 h-20 rounded-3xl";
    textSizeClass = "text-xl leading-none";
    letterSize = "w-20 h-20";
  }

  const handleLogoError = () => {
    if (logoSource === 'local') {
      console.warn("Local official logo failed, falling back to secure Instagram backup URL");
      setLogoSource('backup');
    } else if (logoSource === 'backup') {
      console.error("Backup logo URL failed, falling back to highly responsive vector SVG monogram R rendering");
      setLogoSource('svg');
    }
  };

  return (
    <div className="flex items-center gap-3 select-none justify-start">
      <div className={`relative ${iconSizeClass} overflow-hidden flex items-center justify-center shrink-0 transition-transform hover:scale-105 duration-300`}>
        {logoSource === 'local' && (
          <img 
            src={OFFICIAL_LOGO_URL} 
            alt="Roomia PMS Logo" 
            className="w-full h-full object-contain mx-auto my-auto"
            onError={handleLogoError}
          />
        )}
        {logoSource === 'backup' && (
          <img 
            src={BACKUP_LOGO_URL} 
            alt="Roomia PMS Logo" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain mx-auto my-auto"
            onError={handleLogoError}
          />
        )}
        {logoSource === 'svg' && (
          <div className="w-full h-full bg-brand-navy2 flex items-center justify-center p-1.5 animate-pulse">
            {renderFallbackSvg(letterSize)}
          </div>
        )}
      </div>

      {showText && (
        <div className="flex flex-col text-left justify-center">
          <span className={`font-serif font-extrabold tracking-wider uppercase ${textSizeClass} ${lightText ? 'text-white' : 'text-brand-navy2'}`}>
            ROOMIA PMS
          </span>
        </div>
      )}
    </div>
  );
}

