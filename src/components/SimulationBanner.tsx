/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { User } from '../types';
import { Shield, UserSquare, CalendarClock, RefreshCw } from 'lucide-react';

interface SimulationBannerProps {
  users: User[];
  activeUserId: string;
  onSwitchUser: (userId: string) => void;
  onReset: () => void;
}

export default function SimulationBanner({
  users,
  activeUserId,
  onSwitchUser,
  onReset
}: SimulationBannerProps) {
  const activeUser = users.find(u => u.id === activeUserId);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div id="sim-banner" className="bg-neutral-900 text-neutral-100 px-4 py-2 flex flex-wrap gap-4 items-center justify-between text-xs border-b border-neutral-800 sticky top-0 z-50 shadow-md">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
        <span className="font-mono text-[10px] tracking-wider text-neutral-400 uppercase">SUITE SIMULADOR MULTI-ROL</span>
        <div className="hidden md:flex gap-1 items-center px-2 py-0.5 rounded bg-neutral-800 text-teal-300 font-mono font-medium">
          {activeUser?.rol === 'super_admin' && <Shield className="w-3 h-3 text-red-400" />}
          {activeUser?.rol === 'hotel_admin' && <UserSquare className="w-3 h-3 text-amber-400" />}
          {activeUser?.rol === 'recepcionista' && <CalendarClock className="w-3 h-3 text-indigo-400" />}
          {activeUser?.rol === 'cliente' && <UserSquare className="w-3 h-3 text-emerald-400" />}
          <span className="capitalize">{activeUser?.rol.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-neutral-400 font-medium">Probar perfil:</span>
        <div className="flex gap-1.5 overflow-x-auto py-1">
          {users.map(u => {
            const isSelected = u.id === activeUserId;
            return (
              <button
                key={u.id}
                onClick={() => onSwitchUser(u.id)}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer font-medium whitespace-nowrap ${
                  isSelected
                    ? 'bg-teal-500 text-neutral-950 shadow-sm font-semibold scale-105'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                }`}
              >
                {u.nombre} ({u.rol === 'super_admin' ? 'S.Admin' : u.rol === 'hotel_admin' ? 'H.Admin' : u.rol === 'recepcionista' ? 'Recep' : 'Cliente'})
              </button>
            );
          })}
        </div>

        <div className="h-4 w-[1px] bg-neutral-800" />

        {confirmReset ? (
          <div className="flex items-center gap-1.5 bg-red-950/80 p-1 rounded border border-red-800">
            <button
              onClick={() => setConfirmReset(false)}
              className="px-2 py-0.5 text-[9px] text-neutral-300 hover:bg-neutral-800 rounded font-semibold cursor-pointer"
            >
              No, Volver
            </button>
            <button
              onClick={() => {
                onReset();
                setConfirmReset(false);
              }}
              className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold rounded cursor-pointer"
            >
              Sí, Resetear
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/40 border border-red-800/30 text-red-300 hover:bg-red-950/60 transition-colors cursor-pointer"
            title="Reset de Fábrica"
          >
            <RefreshCw className="w-3.2 h-3.2 animate-spin-hover" />
            <span>Restaurar</span>
          </button>
        )}
      </div>
    </div>
  );
}
