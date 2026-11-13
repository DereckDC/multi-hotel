import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  /** id del elemento al que se vuelve al cambiar de página */
  scrollToId?: string;
  noun?: string;
}

export const totalPagesOf = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize));

export function Pager({ page, pageSize, total, onChange, scrollToId, noun = 'resultados' }: PagerProps) {
  const pages = totalPagesOf(total, pageSize);
  if (total <= pageSize) return null;

  const go = (p: number) => {
    const target = Math.min(pages, Math.max(1, p));
    if (target === page) return;
    onChange(target);
    if (scrollToId) {
      setTimeout(() => document.getElementById(scrollToId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    }
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'min-w-9 h-9 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center cursor-pointer';

  return (
    <nav aria-label="Paginación" className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <p className="text-xs text-neutral-500 font-medium">
        Mostrando <b className="text-neutral-800">{from}–{to}</b> de <b className="text-neutral-800">{total}</b> {noun}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
          className={`${btn} border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Página ${p}`}
            className={`${btn} ${p === page ? 'bg-teal-600 border-teal-600 text-white shadow-sm' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page === pages}
          aria-label="Página siguiente"
          className={`${btn} border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
