import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Maximize2, X, Image as ImageIcon } from 'lucide-react';
import { isVideoUrl, getMediaEmbed } from './RoomImageGallery';

interface HotelImageGalleryProps {
  imagenes: string[];
  portada: string;
  hotelNombre: string;
}

export function HotelImageGallery({ imagenes, portada, hotelNombre }: HotelImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right

  // If there are uploaded photos ('imagenes' array is not empty), we display only those photos
  // to prevent an extra default cover page ('portada') from showing up. Otherwise we fallback to portada.
  const unfilteredList = (imagenes && imagenes.filter(img => img && img.trim() !== '').length > 0)
    ? (imagenes || [])
    : [portada];
    
  const allImages = Array.from(new Set(unfilteredList.filter(img => img && img.trim() !== '')));
  
  // Fallback in case of empty list
  if (allImages.length === 0) {
    allImages.push('https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&fit=crop');
  }

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.98
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring', stiffness: 350, damping: 30 },
        opacity: { duration: 0.25 },
        scale: { duration: 0.25 }
      }
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.98,
      transition: {
        x: { type: 'spring', stiffness: 350, damping: 30 },
        opacity: { duration: 0.2 }
      }
    })
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(-1);
    setActiveIndex(prev => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(1);
    setActiveIndex(prev => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const selectIndex = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDirection(idx > activeIndex ? 1 : -1);
    setActiveIndex(idx);
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Immersive Main Slide */}
      <div 
        className="relative rounded-2xl overflow-hidden h-80 md:h-96 bg-neutral-900 shadow-lg border border-neutral-200 group cursor-pointer"
        onClick={() => setIsLightboxOpen(true)}
      >
        {/* Animated image container */}
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={activeIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full h-full"
            >
              {getMediaEmbed(allImages[activeIndex], "w-full h-full object-cover select-none")}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Ambient Darkened Gradient vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-black/20 to-neutral-950/20 pointer-events-none" />

        {/* Info Text Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-7 flex justify-between items-end pointer-events-none">
          <div className="space-y-1 text-white">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/90 text-[9px] font-bold uppercase tracking-wider border border-white/10 shadow-sm">
              <ImageIcon className="w-3 h-3" />
              <span>Galería Roomia</span>
            </div>
            <h3 className="text-xl md:text-3xl font-display font-semibold tracking-tight leading-tight text-white drop-shadow-sm">
              {hotelNombre}
            </h3>
            <p className="text-xs text-neutral-350 font-medium drop-shadow-sm">
              Visualizando perspectiva {activeIndex + 1} de {allImages.length}
            </p>
          </div>

          {/* Interactive Zoom pill */}
          <div className="hidden sm:flex items-center gap-1.5 bg-white/95 backdrop-blur-md text-neutral-800 font-semibold text-xs py-2 px-3.5 rounded-xl border border-neutral-100 shadow-md group-hover:scale-105 duration-300 pointer-events-none">
            <Maximize2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Expandir</span>
          </div>
        </div>

        {/* Action slide navigation controls */}
        {allImages.length > 1 && (
          <div className="absolute inset-x-4 inset-y-0 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
            <button
              onClick={handlePrev}
              type="button"
              className="w-10 h-10 bg-white/95 hover:bg-white text-neutral-800 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer pointer-events-auto border border-neutral-100"
              title="Imagen Anterior"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-700" />
            </button>
            <button
              onClick={handleNext}
              type="button"
              className="w-10 h-10 bg-white/95 hover:bg-white text-neutral-800 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer pointer-events-auto border border-neutral-100"
              title="Siguiente Imagen"
            >
              <ChevronRight className="w-5 h-5 text-neutral-700" />
            </button>
          </div>
        )}

        {/* Mini progress tracker index */}
        <div className="absolute top-4 right-4 bg-black/75 px-3 py-1 rounded-full text-[10px] font-mono text-white/90 font-bold border border-white/10 shadow-lg tracking-widest leading-none z-10">
          {activeIndex + 1} / {allImages.length}
        </div>
      </div>

      {/* Styled Grid of Thumbnails with micro-interaction triggers */}
      <div className="grid grid-cols-5 gap-2.5">
        {allImages.map((img, idx) => {
          const isItemVideo = isVideoUrl(img);
          return (
            <button
              key={idx}
              onClick={(e) => selectIndex(idx, e)}
              type="button"
              className={`relative rounded-xl overflow-hidden aspect-[4/3] w-full border-2 transition-all duration-300 group cursor-pointer ${
                idx === activeIndex
                  ? 'border-teal-500 scale-[1.03] shadow-md shadow-teal-500/10'
                  : 'border-neutral-200/80 filter hover:brightness-105 hover:border-neutral-350 opacity-80 hover:opacity-100'
              }`}
            >
              {isItemVideo ? (
                <div className="w-full h-full bg-neutral-950 flex flex-col items-center justify-center text-white relative">
                  <div className="absolute top-1 right-1 bg-red-650 rounded px-1.5 py-0.5 z-10 scale-75">
                    <span className="text-[7px] uppercase font-bold tracking-wider text-white">Video</span>
                  </div>
                  <span className="text-sm">🎥</span>
                </div>
              ) : (
                <img src={img} alt={`Perspectiva ${idx + 1}`} className="w-full h-full object-cover select-none" referrerPolicy="no-referrer" />
              )}
              <div className={`absolute inset-0 bg-teal-900/10 transition-opacity duration-3000 ${idx === activeIndex ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          );
        })}
      </div>

      {/* IMMERSIVE COMPREHENSIVE LIGHTBOX CAROUSEL MODAL */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isLightboxOpen && (
            <div 
              className="fixed inset-0 bg-neutral-950/95 z-[9999] flex flex-col justify-between p-4 md:p-6 backdrop-blur-xl select-none"
              onClick={() => setIsLightboxOpen(false)}
            >
              {/* Top Bar controls */}
              <div 
                className="flex justify-between items-center text-white" 
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <h5 className="font-semibold text-base font-display">{hotelNombre}</h5>
                  <p className="text-xs text-neutral-400">Expediente de Fotos ({activeIndex + 1} de {allImages.length})</p>
                </div>
                <button 
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-2.5 hover:bg-white/10 text-neutral-300 hover:text-white rounded-full transition-all cursor-pointer border border-white/5 bg-white/5 shadow-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Stage element */}
              <div 
                className="relative flex-1 flex items-center justify-center max-h-[75vh] my-4 w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeIndex}
                    className="max-w-full max-h-full aspect-video md:aspect-[16/9] w-full max-w-4xl flex items-center justify-center p-1 rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/5"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                  >
                    {getMediaEmbed(allImages[activeIndex], "max-w-full max-h-full object-contain rounded-xl")}
                  </motion.div>
                </AnimatePresence>

                {/* Huge navigators */}
                {allImages.length > 1 && (
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

              {/* Immersive Thumbnails belt */}
              <div 
                className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2.5 bg-neutral-900/60 p-4 rounded-3xl border border-white/10 backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
              >
                {allImages.map((img, idx) => {
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
    </div>
  );
}
