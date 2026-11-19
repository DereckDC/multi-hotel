import React from 'react';
import { Room } from '../types';
import { ActivityLog } from '../store';
import { Hammer, ShieldAlert, Home, MapPin } from 'lucide-react';
import { Button, SelectPicker } from './ui';

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
  const isProperty = receptionistHotel?.tipoEstablecimiento === 'casa' || receptionistHotel?.tipoEstablecimiento === 'departamento';
  const propertyType = receptionistHotel?.tipoEstablecimiento === 'casa' ? 'Casa' : 'Departamento';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in duration-300" id="reception-incidencias-module">
      
      {/* LEFT: Registrar Incidencia Form */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex items-center gap-2">
            <Hammer className="w-5 h-5 text-danger-600" />
            <h4 className="text-base font-bold text-brand-navy1">Registrar incidencia</h4>
          </div>

          <form onSubmit={handleReportIncident} className="space-y-4">
            {incidentSubmitted && (
              <div className="bg-success-50 border border-success-300 text-success-800 p-3 rounded-xl text-xs font-medium">
                {isProperty
                  ? 'Incidencia de la propiedad guardada con éxito.'
                  : 'Incidencia guardada con éxito. Habitación colocada en Mantenimiento.'}
              </div>
            )}

            {isProperty ? (
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-xs font-bold text-neutral-800 truncate">{receptionistHotel?.nombre}</span>
                  <span className="ml-auto text-micro font-bold uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">{propertyType}</span>
                </div>
                {receptionistHotel?.ubicacion && (
                  <p className="text-micro text-neutral-500 flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-400" />{receptionistHotel.ubicacion}</p>
                )}
                <p className="text-micro text-neutral-400">La incidencia se registrará para toda la propiedad.</p>
              </div>
            ) : (
            <div>
              <label className="text-xs font-semibold text-neutral-500 block mb-1">Seleccionar Habitación:</label>
              <SelectPicker label="Seleccionar Habitación"
                required
                value={incidentRoomId}
                onChange={(e) => setIncidentRoomId(e.target.value)}
                className="w-full text-xs border border-neutral-200 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none bg-white cursor-pointer text-neutral-800"
              >
                <option value="">Elegir número de cuarto...</option>
                {rooms.filter(r => r.hotelId === receptionistHotel?.id).map(r => (
                  <option key={r.id} value={r.id}>Cuarto {r.numero} ({r.nombre})</option>
                ))}
              </SelectPicker>
            </div>
            )}

            <div>
              <label className="text-xs font-semibold text-neutral-500 block mb-1">Descripción del desperfecto:</label>
              <textarea
                required
                placeholder="Ej: Fuga de agua en el lavabo del baño, persiana principal atascada, etc."
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                className="w-full text-xs border border-neutral-200 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none h-20"
              />
            </div>

            <Button
              type="submit"
              variant="primary" size="md" className="w-full"
            >
              Reportar Incidencia
            </Button>
          </form>
        </div>
      </div>

      {/* RIGHT: Bitácora Histórica de Incidencias */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-4">
          <div className="border-b border-neutral-100 pb-3 flex justify-between items-center">
            <div>
              <h4 className="text-base font-bold text-brand-navy1">Historial de incidencias</h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                Historial consolidado de desperfectos, averías y reparaciones técnicas registradas en este establecimiento.
              </p>
            </div>
            <span className="text-xs bg-danger-50 text-danger-600 border border-danger-100 px-2.5 py-0.5 rounded-full font-bold font-mono">
              {hotelIncidents.length} reportadas
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {hotelIncidents.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">
                <ShieldAlert className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                <p className="font-semibold text-xs">Sin incidencias reportadas</p>
                <p className="text-micro mt-1">El establecimiento se encuentra operando al 100% libre de desperfectos técnicos.</p>
              </div>
            ) : (
              hotelIncidents.map((log) => (
                <div key={log.id} className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100/60 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-neutral-100/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-danger-50 text-danger-700 border border-danger-100 rounded-lg text-micro font-bold uppercase">Reporte</span>
                      <span className="text-micro font-mono text-neutral-400 font-medium">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs font-semibold text-neutral-800 leading-normal">{log.detalles}</p>
                    <p className="text-micro text-neutral-400">Registrado por: <strong className="text-neutral-600">{log.user}</strong> ({log.role})</p>
                  </div>
                  
                  <div className="shrink-0">
                    <span className="px-2 py-1 bg-warning-50 text-warning-700 border border-warning-100 rounded-lg text-micro font-mono font-bold uppercase">
                      {isProperty ? 'Reporte de propiedad' : 'Mantenimiento Activo'}
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
