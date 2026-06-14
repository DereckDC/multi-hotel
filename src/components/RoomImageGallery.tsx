import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';

export function isVideoUrl(url: string | undefined): boolean {
  if (!url) return false;
  const cleanUrl = url.toLowerCase().split('?')[0].split('#')[0];
  return (
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.webm') ||
    cleanUrl.endsWith('.ogg') ||
    cleanUrl.endsWith('.mov') ||
    url.includes('youtube.com/embed/') ||
    url.includes('youtube.com/watch') ||
    url.includes('youtu.be/') ||
    url.includes('vimeo.com/') ||
    url.includes('video_') ||
    url.startsWith('data:video/')
  );
}

export function getMediaEmbed(url: string, className = "w-full h-full object-cover") {
  if (!url) return null;
  const lower = url.toLowerCase();
  
  if (lower.includes('youtube.com/watch') || lower.includes('youtu.be/')) {
    let videoId = '';
    if (lower.includes('youtube.com/watch')) {
      const match = url.match(/[?&]v=([^&#]+)/);
      videoId = match ? match[1] : '';
    } else {
      const parts = url.split('/');
      videoId = parts[parts.length - 1];
    }
    if (videoId) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube Video"
          className={className}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }
  }
  
  if (lower.includes('youtube.com/embed/')) {
    return (
      <iframe
        src={url}
        title="YouTube Video"
        className={className}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (lower.includes('vimeo.com/')) {
    const parts = url.split('/');
    const videoId = parts[parts.length - 1];
    if (videoId && !isNaN(Number(videoId))) {
      return (
        <iframe
          src={`https://player.vimeo.com/video/${videoId}`}
          title="Vimeo Video"
          className={className}
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }
  }

  if (
    lower.endsWith('.mp4') || 
    lower.endsWith('.webm') || 
    lower.endsWith('.ogg') || 
    lower.endsWith('.mov') || 
    lower.startsWith('data:video/') || 
    lower.includes('/video/')
  ) {
    return (
      <video
        src={url}
        controls
        className={className}
        preload="metadata"
      />
    );
  }

  return (
    <img 
      src={url} 
      alt="Media element" 
      className={className} 
      referrerPolicy="no-referrer" 
    />
  );
}

interface RoomImageGalleryProps {
  imagenes: string[];
  roomNombre: string;
  className?: string;
}

export function RoomImageGallery({ imagenes, roomNombre, className }: RoomImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Filter out any blank URLs
  const validImages = (imagenes || []).filter(img => img && img.trim() !== '');
  
  // Fallback if no images found
  const fallbackImage = 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&auto=format&fit=crop&q=80';
  const displayImages = validImages.length > 0 ? validImages : [fallbackImage];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex(prev => (prev === 0 ? displayImages.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex(prev => (prev === displayImages.length - 1 ? 0 : prev + 1));
  };

  const selectIndex = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex(idx);
  };

  const wrapperClass = className || "relative w-full md:w-56 h-36 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-150 shadow-sm group cursor-pointer";

  return (
    <>
      <div 
        className={wrapperClass}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsLightboxOpen(true)}
      >
        {/* Animated Slide Content */}
        <div className="absolute inset-0 w-full h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              className="w-full h-full"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {getMediaEmbed(displayImages[activeIndex], "w-full h-full object-cover select-none")}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Shadow overlays */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Left/Right Controls visible on hover or mobile */}
        {displayImages.length > 1 && (
          <div className={`absolute inset-y-0 inset-x-2 flex justify-between items-center z-10 pointer-events-none transition-all duration-300 ${
            isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 md:opacity-0 pointer-events-none'
          }`}>
            <button
              onClick={handlePrev}
              type="button"
              className="w-7 h-7 bg-white/95 hover:bg-white text-neutral-800 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all cursor-pointer pointer-events-auto border border-neutral-200"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              type="button"
              className="w-7 h-7 bg-white/95 hover:bg-white text-neutral-800 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all cursor-pointer pointer-events-auto border border-neutral-200"
              title="Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Small badge of active image count */}
        <div className="absolute top-2 left-2 bg-neutral-900/75 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md tracking-wider border border-white/10">
          {activeIndex + 1}/{displayImages.length}
        </div>

        {/* Hover Eye indicator to expand */}
        <div className="absolute top-2 right-2 bg-neutral-900/75 text-white hover:bg-neutral-900 duration-200 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 z-15">
          <Maximize2 className="w-3 h-3" />
        </div>

        {/* Floating Indicator Dots */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1 z-10">
            {displayImages.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => selectIndex(idx, e)}
                type="button"
                className={`h-1.5 rounded-full transition-all duration-350 cursor-pointer pointer-events-auto ${
                  activeIndex === idx ? 'w-3.5 bg-teal-500' : 'w-1.5 bg-white/60 hover:bg-white'
                }`}
                title={`Ver imagen ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* FULL-RESOLUTION LIGHTBOX CAROUSEL */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isLightboxOpen && (
            <div 
              className="fixed inset-0 bg-neutral-950/95 z-[9999] flex flex-col justify-between p-4 md:p-6 backdrop-blur-xl select-none"
              onClick={() => setIsLightboxOpen(false)}
            >
              {/* Top Bar of Lightbox */}
              <div 
                className="flex justify-between items-center text-white" 
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <h5 className="font-semibold text-base font-display">{roomNombre}</h5>
                  <p className="text-xs text-neutral-400">Galería de Fotos ({activeIndex + 1} de {displayImages.length})</p>
                </div>
                <button 
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-2.5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-full transition-all cursor-pointer border border-white/5 bg-white/5 shadow-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Main Stage Image */}
              <div 
                className="relative flex-1 flex items-center justify-center max-h-[85vh] my-2 w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeIndex}
                    className="max-w-full max-h-full aspect-video md:aspect-[16/9] w-full max-w-6xl flex items-center justify-center p-1 rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    {getMediaEmbed(displayImages[activeIndex], "max-w-full max-h-full object-contain rounded-xl")}
                  </motion.div>
                </AnimatePresence>

                {/* Huge Navigation Arrows on stage */}
                {displayImages.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      className="absolute left-2 md:left-6 w-12 h-12 bg-neutral-900/85 hover:bg-neutral-800 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer z-30 border border-white/10"
                      title="Anterior"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-2 md:right-6 w-12 h-12 bg-neutral-900/85 hover:bg-neutral-800 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer z-30 border border-white/10"
                      title="Siguiente"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom thumbnail selector of Lightbox */}
              <div 
                className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2.5 bg-neutral-900/60 p-4 rounded-3xl border border-white/10 backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
              >
                {displayImages.map((img, idx) => {
                  const isItemVideo = isVideoUrl(img);
                  return (
                    <button
                      key={idx}
                      onClick={(e) => selectIndex(idx, e)}
                      className={`relative w-16 md:w-20 h-11 md:h-14 rounded-xl overflow-hidden border transition-all duration-300 cursor-pointer ${
                        activeIndex === idx 
                          ? 'border-teal-500 scale-105 ring-4 ring-teal-500/20 shadow-lg' 
                          : 'border-white/10 opacity-40 hover:opacity-100 hover:border-white/40'
                      }`}
                    >
                      {isItemVideo ? (
                        <div className="w-full h-full bg-neutral-950 flex flex-col items-center justify-center text-white relative">
                          <div className="absolute top-0.5 right-0.5 bg-red-650 rounded px-1 py-0.2 scale-75 z-10">
                            <span className="text-[6px] uppercase font-bold tracking-wider text-white">Video</span>
                          </div>
                          <span className="text-sm">🎥</span>
                        </div>
                      ) : (
                        <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
