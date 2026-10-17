/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2, Sparkles, Database } from 'lucide-react';

interface LoadingSkeletonViewProps {
  role?: string;
  clientTab?: string;
  adminTab?: string;
  receptionTab?: string;
}

export const LoadingSkeletonView: React.FC<LoadingSkeletonViewProps> = ({
  role = 'cliente',
  clientTab = 'explore',
  adminTab = 'dashboard',
  receptionTab = 'checkin',
}) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 select-none animate-fade-in">
      
      {/* Dynamic Sync Status Banner with Spinner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-[#0E2A47] to-slate-900 border border-brand-cyan/25 p-4 sm:p-5 shadow-lg shadow-brand-cyan/5 mb-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-brand-cyan/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center shrink-0 shadow-inner">
              <Loader2 className="w-5 h-5 text-brand-cyan animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Sincronizando información desde Supabase
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-ping inline-block" />
                  En vivo
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Cargando habitaciones, propiedades, reservas y disponibilidad en tiempo real...
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-slate-300 text-xs font-mono">
              <Database className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Supabase DB</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            </div>
          </div>

        </div>

        {/* Shimmer progress line */}
        <div className="mt-3.5 w-full bg-slate-800/80 rounded-full h-1 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-transparent via-brand-cyan to-transparent animate-progressive w-full rounded-full" />
        </div>
      </div>

      {/* Skeletons rendering based on view / role */}
      {(role === 'cliente' || !role) && (
        clientTab === 'reservations' ? (
          /* Client Reservations Skeleton */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-4 w-72 bg-slate-200 rounded-md animate-pulse" />
              </div>
              <div className="h-10 w-36 bg-slate-200 rounded-xl animate-pulse" />
            </div>

            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="bg-white rounded-2xl p-5 border border-neutral-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-20 h-20 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                    <div className="space-y-2.5 flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-24 bg-slate-200 rounded-full animate-pulse" />
                        <div className="h-4 w-16 bg-slate-200 rounded-md animate-pulse" />
                      </div>
                      <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse" />
                      <div className="h-4 w-32 bg-slate-200 rounded-md animate-pulse" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <div className="h-10 w-24 bg-slate-200 rounded-xl animate-pulse" />
                    <div className="h-10 w-28 bg-slate-200 rounded-xl animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Client Explore / Properties Skeleton */
          <div className="space-y-8">
            
            {/* Top Search & Filter Bar Skeleton */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />
                <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />
                <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />
                <div className="h-12 bg-brand-cyan/20 rounded-xl animate-pulse" />
              </div>

              {/* Tag / Category Filter Pills Skeleton */}
              <div className="flex items-center gap-2 pt-2 overflow-x-auto pb-1">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div key={idx} className="h-8 w-24 bg-slate-200 rounded-full animate-pulse shrink-0" />
                ))}
              </div>
            </div>

            {/* Quick Metrics / Highlights Skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((stat) => (
                <div key={stat} className="bg-white p-4 rounded-xl border border-neutral-200/80 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                    <div className="h-5 w-20 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>

            {/* Grid of Cards Skeletons */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="space-y-1">
                  <div className="h-6 w-44 bg-slate-200 rounded-lg animate-pulse" />
                  <div className="h-4 w-60 bg-slate-200 rounded-md animate-pulse" />
                </div>
                <div className="h-9 w-32 bg-slate-200 rounded-lg animate-pulse" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((card) => (
                  <div key={card} className="bg-white rounded-2xl overflow-hidden border border-neutral-200/80 shadow-sm flex flex-col">
                    {/* Image Skeleton */}
                    <div className="relative h-52 bg-slate-200 animate-pulse">
                      <div className="absolute top-3 left-3 h-6 w-24 bg-white/70 backdrop-blur-sm rounded-full animate-pulse" />
                      <div className="absolute top-3 right-3 h-8 w-8 bg-white/70 backdrop-blur-sm rounded-full animate-pulse" />
                    </div>

                    {/* Card Content Skeleton */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="h-4 w-28 bg-slate-200 rounded-md animate-pulse" />
                          <div className="h-4 w-14 bg-slate-200 rounded-md animate-pulse" />
                        </div>
                        <div className="h-6 w-3/4 bg-slate-200 rounded-lg animate-pulse" />
                        <div className="h-4 w-1/2 bg-slate-200 rounded-md animate-pulse" />
                      </div>

                      {/* Amenities pills skeleton */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <div className="h-5 w-16 bg-slate-200 rounded-full animate-pulse" />
                        <div className="h-5 w-14 bg-slate-200 rounded-full animate-pulse" />
                        <div className="h-5 w-18 bg-slate-200 rounded-full animate-pulse" />
                      </div>

                      {/* Footer separator, price & button skeleton */}
                      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="h-3 w-12 bg-slate-200 rounded animate-pulse" />
                          <div className="h-6 w-24 bg-slate-200 rounded-md animate-pulse" />
                        </div>
                        <div className="h-10 w-28 bg-brand-cyan/20 rounded-xl animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )
      )}

      {/* Reception Skeleton */}
      {role === 'recepcionista' && (
        <div className="space-y-6">
          {/* Quick modules header */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            <div className="h-11 w-44 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-11 w-44 bg-slate-200 rounded-xl animate-pulse" />
            <div className="h-11 w-44 bg-slate-200 rounded-xl animate-pulse" />
          </div>

          {/* Scanner & Walk-in card skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
              <div className="h-6 w-36 bg-slate-200 rounded-lg animate-pulse" />
              <div className="h-48 w-full bg-slate-200 rounded-xl animate-pulse flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
              </div>
              <div className="h-10 w-full bg-slate-200 rounded-xl animate-pulse" />
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-8 w-28 bg-slate-200 rounded-lg animate-pulse" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="h-14 bg-slate-200 rounded-xl animate-pulse flex items-center px-4 justify-between">
                    <div className="h-4 w-32 bg-white/60 rounded" />
                    <div className="h-4 w-24 bg-white/60 rounded" />
                    <div className="h-7 w-20 bg-white/60 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Skeleton */}
      {(role === 'hotel_admin' || role === 'super_admin') && (
        <div className="space-y-8">
          {/* Admin KPI Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((kpi) => (
              <div key={kpi} className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-sm flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-8 w-28 bg-slate-200 rounded-lg animate-pulse" />
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-200 animate-pulse" />
              </div>
            ))}
          </div>

          {/* Admin Chart / Analytics Skeleton */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse" />
                <div className="h-4 w-64 bg-slate-200 rounded-md animate-pulse" />
              </div>
              <div className="h-9 w-32 bg-slate-200 rounded-lg animate-pulse" />
            </div>
            <div className="h-64 w-full bg-slate-200 rounded-xl animate-pulse flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
            </div>
          </div>

          {/* Admin Table Skeleton */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <div className="h-6 w-40 bg-slate-200 rounded-lg animate-pulse" />
              <div className="h-9 w-28 bg-slate-200 rounded-lg animate-pulse" />
            </div>
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="h-12 bg-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default LoadingSkeletonView;
