/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRViewProps {
  value: string;
  size?: number;
}

export default function QRView({ value, size = 160 }: QRViewProps) {
  const [imgSrc, setImgSrc] = useState<string>('');

  useEffect(() => {
    if (!value) return;
    
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: '#111827', // Gray 900
        light: '#FFFFFF'
      }
    })
    .then(url => {
      setImgSrc(url);
    })
    .catch(err => {
      console.error("Failed to generate real QR Code:", err);
    });
  }, [value, size]);

  return (
    <div className="flex flex-col items-center justify-center bg-white p-3 rounded-xl shadow-inner border border-neutral-100 transition-all hover:scale-[1.02]" style={{ width: size + 24, height: size + 24 }}>
      {imgSrc ? (
        <img 
          src={imgSrc} 
          alt="QR Code" 
          className="rounded-lg shadow-sm select-auto" 
          style={{ width: size, height: size }} 
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="animate-pulse bg-neutral-200 rounded-lg flex items-center justify-center" style={{ width: size, height: size }}>
          <span className="text-[10px] text-neutral-400 font-mono">Generando...</span>
        </div>
      )}
      <div className="mt-2 text-center select-all">
        <span className="text-[10px] uppercase tracking-wider font-mono text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
          {value.split('-')[1] || value.slice(0, 10)}
        </span>
      </div>
    </div>
  );
}
