import React from 'react';
import { Room } from '../types';
import { ActivityLog } from '../store';
import { Hammer, ShieldAlert } from 'lucide-react';

interface ReceptionIncidenciasModuleProps {
  rooms: Room[];
  receptionistHotel: any;
  incidentRoomId: string;
  setIncidentRoomId: (val: string) => void;
  incidentText: string;
  setIncidentText: (val: string) => void;
  incidentSubmitted: boolean;
  handleReportIncident: (e: React.FormEvent) => void;
  hotelIncidents: ActivityLog[];
}

export default function ReceptionIncidenciasModule({
  rooms,
  receptionistHotel,
  incidentRoomId,
  setIncidentRoomId,
  incidentText,
  setIncidentText,
  incidentSubmitted,
  handleReportIncident,
  hotelIncidents
}: ReceptionIncidenciasModuleProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in duration-300" id="reception-incidencias-module">
      
      {/* LEFT: Registrar Incidencia Form */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex items-center gap-2">
            <Hammer className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-neutral-900 text-base">Registrar Incidencia</h4>
          </div>

          <form onSubmit={handleReportIncident} className="space-y-4">
            {incidentSubmitted && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-xs font-medium">
                Incidencia guardada con éxito. Habitación colocada en Mantenimiento.
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-neutral-500 block mb-1">Seleccionar Habitación:</label>
              <select
                required
                value={incidentRoomId}
                onChange={(e) => setIncidentRoomId(e.target.value)}
                className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white cursor-pointer text-neutral-800"
              >
                <option value="">Elegir número de cuarto...</option>
                {rooms.filter(r => r.hotelId === receptionistHotel?.id).map(r => (
                  <option key={r.id} value={r.id}>Cuarto {r.numero} ({r.nombre})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-500 block mb-1">Descripción del desperfecto:</label>
              <textarea
                required
                placeholder="Ej: Fuga de agua en el lavabo del baño, persiana principal atascada, etc."
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                className="w-full text-xs border border-neutral-250 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none h-20"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-neutral-900 text-white font-bold py-2 rounded-xl text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Reportar Incidencia
            </button>
          </form>
        </div>
      </div>

      {/* RIGHT: Bitácora Histórica de Incidencias */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-3xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-neutral-800 text-base">Bitácora Histórica de Incidencias</h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                Historial consolidado de desperfectos, averías y reparaciones técnicas registradas en este establecimiento.
              </p>
            </div>
            <span className="text-xs bg-red-50 text-red-600 border border-red-150 px-2.5 py-0.5 rounded-full font-bold font-mono">
              {hotelIncidents.length} reportadas
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {hotelIncidents.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <ShieldAlert className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                <p className="font-semibold text-xs">Sin incidencias reportadas</p>
                <p className="text-[10px] mt-1">El establecimiento se encuentra operando al 100% libre de desperfectos técnicos.</p>
              </div>
            ) : (
              hotelIncidents.map((log) => (
                <div key={log.id} className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-150/60 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-neutral-100/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded text-[9px] font-bold uppercase">Reporte</span>
                      <span className="text-[10px] font-mono text-neutral-400 font-medium">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-semibold text-neutral-850 leading-normal">{log.detalles}</p>
                    <p className="text-[10px] text-neutral-400">Registrado por: <strong className="text-neutral-600">{log.user}</strong> ({log.role})</p>
                  </div>
                  
                  <div className="shrink-0">
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-[9px] font-mono font-bold uppercase">
                      Mantenimiento Activo
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
