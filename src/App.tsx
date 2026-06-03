/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { useHotelStore } from './store';
import ClientView from './components/ClientView';
import ReceptionView from './components/ReceptionView';
import AdminView from './components/AdminView';
import LoginView from './components/LoginView';
import LandingPageView from './components/LandingPageView';
import { LayoutDashboard, Users, User as UserIcon, CalendarDays, KeyRound, Star, Sparkles, Building2, ShieldAlert, LogOut, Edit3, Camera, Check, X, Shield, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const store = useHotelStore();
  const {
    activeUser,
    activeUserId,
    users,
    hotels,
    rooms,
    reservations,
    logs,
    switchSessionUser,
    factoryResetAll,
    saveHotel,
    deleteHotel,
    saveRoom,
    deleteRoom,
    updateRoomStatus,
    updateUserRole,
    updateUserHotel,
    toggleUserStatus,
    registerUser,
    updateUserProfile,
    changeUserPassword,
    createReservation,
    cancelReservation,
    deleteReservation,
    updateReservationStatus
  } = store;

  // Track if user explicitly logged out or lacks active session to show login screen
  const [isLoggedOut, setIsLoggedOut] = useState(() => {
    try {
      const saved = localStorage.getItem('aura_hotel_pms_current_user_id');
      if (!saved) return true;
      const parsed = JSON.parse(saved);
      return !parsed;
    } catch {
      return true;
    }
  });

  const [showLandingPage, setShowLandingPage] = useState(false);

  // Real-time Ecuador GMT-5 clock for the general footer
  const [ecuadorTime, setEcuadorTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      try {
        const timeStr = new Date().toLocaleString("es-EC", {
          timeZone: "America/Guayaquil",
          dateStyle: 'medium',
          timeStyle: 'medium'
        });
        setEcuadorTime(timeStr);
      } catch (err) {
        const local = new Date();
        const utc = local.getTime() + (local.getTimezoneOffset() * 60000);
        const gmt5 = new Date(utc - (3600000 * 5));
        setEcuadorTime(gmt5.toLocaleString() + ' GMT-5');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Profile Edit Modal States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileNombre, setProfileNombre] = useState('');
  const [profileApellido, setProfileApellido] = useState('');
  const [profileTelefono, setProfileTelefono] = useState('');
  const [profileDocumento, setProfileDocumento] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePassword, setProfilePassword] = useState('');

  // Forced password change screen state variables
  const [forcedPassInput, setForcedPassInput] = useState('');
  const [forcedConfirmPassInput, setForcedConfirmPassInput] = useState('');
  const [forcedPassLoading, setForcedPassLoading] = useState(false);
  const [forcedPassSuccess, setForcedPassSuccess] = useState('');
  const [forcedPassError, setForcedPassError] = useState('');

  const PRESET_AVATARS = [
    { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=facearea&facepad=2&q=80', label: 'Invitado Sophisticated' },
    { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=facearea&facepad=2&q=80', label: 'Viajero Moderno' },
    { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=facearea&facepad=2&q=80', label: 'Huésped Elegante' },
    { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=facearea&facepad=2&q=80', label: 'Ejecutivo Platino' },
    { url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=facearea&facepad=2&q=80', label: 'Exploradora' },
    { url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=facearea&facepad=2&q=80', label: 'Diseñadora VIP' },
    { url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=facearea&facepad=2&q=80', label: 'Creador Digital' },
    { url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=facearea&facepad=2&q=80', label: 'Socio de Negocios' }
  ];

  const openProfileModal = () => {
    setProfileNombre(activeUser.nombre);
    setProfileApellido(activeUser.apellido);
    setProfileTelefono(activeUser.telefono);
    setProfileDocumento(activeUser.documento);
    setProfileAvatar(activeUser.avatar);
    setProfileEmail(activeUser.email);
    setProfilePassword('');
    setShowProfileModal(true);
  };

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    updateUserProfile(activeUser.id, {
      nombre: profileNombre,
      apellido: profileApellido,
      telefono: profileTelefono,
      documento: profileDocumento,
      avatar: profileAvatar,
      email: profileEmail
    });
    if (profilePassword.trim()) {
      await changeUserPassword(activeUser.id, profilePassword.trim(), false);
    }
    setShowProfileModal(false);
  };

  // Track state audit metrics
  const stats = store.getStatistics();

  const handleAddLogSimulated = (action: string, details: string) => {
    // Helper to log actions within reception
    const logStr = `${activeUser.nombre} ${activeUser.apellido}`;
    store.logs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: logStr,
      role: activeUser.rol,
      action: action,
      detalles: details
    });
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans selection:bg-teal-500 selection:text-neutral-900">
      
      {/* 2. Global application Header */}
      {!showLandingPage && (
        <header className="bg-white border-b border-neutral-100 shadow-sm print:hidden">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-display font-black text-xl shadow-md cursor-pointer hover:scale-105 transition-transform">
                R
              </div>
              <div>
                <span className="font-display font-bold text-neutral-800 text-lg tracking-tight flex items-center gap-1">
                  Roomia <span className="text-teal-600">SaaS</span>
                </span>
                <p className="text-[9px] text-neutral-400 font-mono leading-none tracking-wider font-semibold uppercase">Multi-Hotel PMS Platform</p>
              </div>
            </div>

            {/* Current Persona signature badge */}
            {!isLoggedOut ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={openProfileModal}
                  className="flex items-center gap-3 bg-neutral-50 hover:bg-neutral-100 px-3.5 py-1.5 rounded-2xl border border-neutral-200 shadow-inner group transition-all text-left cursor-pointer relative"
                  title="Haga clic para editar sus datos personales y de contacto o cambiar la foto de su perfil"
                >
                  <div className="text-right hidden sm:block">
                    <span className="font-semibold text-neutral-800 text-xs block leading-tight group-hover:text-teal-700 transition-colors">{activeUser.nombre} {activeUser.apellido}</span>
                    <span className="text-[9px] text-[#344D67] font-semibold capitalize block">{activeUser.rol.replace('_', ' ')}</span>
                  </div>
                  <div className="relative">
                    <img
                      src={activeUser.avatar}
                      alt={activeUser.nombre}
                      className="w-8 h-8 rounded-full border border-neutral-200 shrink-0 shadow group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-teal-600 text-white rounded-full p-0.5 border border-white shadow scale-90 group-hover:scale-100 transition-transform">
                      <Edit3 className="w-2 h-2" />
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('aura_hotel_pms_current_user_id');
                    setIsLoggedOut(true);
                  }}
                  title="Cerrar Sesión"
                  className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-700 rounded-xl transition-all border border-red-200 cursor-pointer text-xs font-semibold flex items-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLandingPage(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-1.5 px-3.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-sm active:scale-95 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>contratanos</span>
                </button>
              </div>
            )}

          </div>
        </header>
      )}

      {/* 3. Panel Container with responsive grid animations */}
      <main className="flex-1 pb-16">
        <AnimatePresence mode="wait">
          {isLoggedOut ? (
            showLandingPage ? (
              <LandingPageView onClose={() => setShowLandingPage(false)} />
            ) : (
              <motion.div
                key="login-screen-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <LoginView
                  users={users}
                  onLoginSuccess={(uid, fetchedUser) => {
                    switchSessionUser(uid, fetchedUser);
                    setIsLoggedOut(false);
                  }}
                  onRegisterUser={registerUser}
                  onShowLanding={() => setShowLandingPage(true)}
                />
              </motion.div>
            )
          ) : (
            <motion.div
              key={activeUser.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {/* ROLE DISPATCHER ROUTING */}
              {activeUser.rol === 'cliente' && (
                <ClientView
                  hotels={hotels}
                  rooms={rooms}
                  reservations={reservations}
                  users={users}
                  activeUser={activeUser}
                  onCreateReservation={createReservation}
                  onCancelReservation={cancelReservation}
                  onDeleteReservation={deleteReservation}
                />
              )}

              {activeUser.rol === 'recepcionista' && (
                <ReceptionView
                  hotels={hotels}
                  rooms={rooms}
                  reservations={reservations}
                  activeUser={activeUser}
                  onPerformCheckIn={store.performCheckIn}
                  onPerformCheckOut={store.performCheckOut}
                  onUpdateRoomStatus={updateRoomStatus}
                  users={users}
                  onAddLog={handleAddLogSimulated}
                  onCreateReservation={createReservation}
                  onRegisterUser={registerUser}
                />
              )}

              {(activeUser.rol === 'hotel_admin' || activeUser.rol === 'super_admin') && (
                <AdminView
                  hotels={hotels}
                  rooms={rooms}
                  users={users}
                  reservations={reservations}
                  logs={logs}
                  activeUser={activeUser}
                  onSaveHotel={saveHotel}
                  onDeleteHotel={deleteHotel}
                  onSaveRoom={saveRoom}
                  onDeleteRoom={deleteRoom}
                  onUpdateUserRole={updateUserRole}
                  onUpdateUserHotel={updateUserHotel}
                  onToggleUserStatus={toggleUserStatus}
                  onChangeUserPassword={changeUserPassword}
                  statistics={stats}
                  onUpdateRoomStatus={updateRoomStatus}
                  onUpdateReservationStatus={updateReservationStatus}
                  onSyncAllToSupabase={store.syncAllToSupabase}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 4. Tiny visual footer */}
      <footer className="py-6 border-t border-neutral-150 text-center text-[10px] text-neutral-400 font-mono print:hidden">
        <p>©2026 Maqyasoft</p>
        <p className="mt-1">Hora Ecuador (GMT-5): {ecuadorTime || 'Cargando...'}</p>
      </footer>

      {/* Global Edit Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-neutral-950/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-neutral-105 flex flex-col scale-100 transition-all duration-200">
            
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 rounded-t-3xl">
              <div>
                <h4 className="font-bold text-neutral-850 text-base flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-teal-600" />
                  Actualizar Datos de Perfil
                </h4>
                <p className="text-[10px] text-neutral-400 mt-0.5 uppercase tracking-wide font-mono">Rol actual: {activeUser.rol.replace('_', ' ')}</p>
              </div>
              <button 
                onClick={() => setShowProfileModal(false)} 
                className="p-1.5 hover:bg-neutral-200 rounded-full cursor-pointer text-neutral-400 hover:text-neutral-600 transition-colors"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-5">
              
              {/* Presets Avatars Picker */}
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans block">Foto / Avatar de Perfil:</label>
                
                <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
                  <img 
                    src={profileAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                    alt="Currently selected avatar" 
                    className="w-16 h-16 rounded-full object-cover border-2 border-teal-500 shadow shrink-0" 
                  />
                  <div className="flex-1">
                    <span className="text-[10px] text-neutral-400 font-medium block">¿Desea usar una imagen preestablecida? Haga clic abajo:</span>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {PRESET_AVATARS.map((av, index) => {
                        const isSelected = profileAvatar === av.url;
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setProfileAvatar(av.url)}
                            className={`w-9 h-9 rounded-full relative overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 hover:shadow-sm ${
                              isSelected ? 'border-teal-500 ring-2 ring-teal-200 scale-105' : 'border-neutral-200 opacity-80 hover:opacity-100'
                            }`}
                            title={av.label}
                          >
                            <img src={av.url} alt="Profile photo preset" className="w-full h-full object-cover" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-teal-650/30 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white drop-shadow-md stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 space-y-2">
                  <span className="text-[10px] text-neutral-400 font-medium block mb-1">O suba una imagen de su dispositivo:</span>
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300 rounded-xl cursor-pointer text-xs text-neutral-700 font-semibold transition-all">
                      <Camera className="w-4 h-4 text-teal-600 animate-pulse" />
                      <span>Seleccionar imagen</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              alert("La imagen excede el límite recomendado de 2MB. Intente con una imagen más liviana.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setProfileAvatar(event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="mt-1">
                    <span className="text-[10px] text-neutral-400 font-medium block mb-1">O ingrese una URL de imagen personalizada:</span>
                    <input
                      type="url"
                      value={profileAvatar}
                      onChange={(e) => setProfileAvatar(e.target.value)}
                      placeholder="https://ejemplo.com/mi-foto.jpg"
                      className="w-full text-xs font-mono border border-neutral-250 p-2.5 rounded-xl bg-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Text Fields Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">Nombre / Primer Nombre:</label>
                  <input
                    type="text" required
                    value={profileNombre}
                    onChange={(e) => setProfileNombre(e.target.value)}
                    placeholder="Ej: Sofía"
                    className="w-full text-xs border border-neutral-250 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">Apellido / Surname:</label>
                  <input
                    type="text" required
                    value={profileApellido}
                    onChange={(e) => setProfileApellido(e.target.value)}
                    placeholder="Ej: Rodríguez"
                    className="w-full text-xs border border-neutral-250 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">Correo Electrónico:</label>
                  <input
                    type="email" required
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="contacto@roomiasaas.com"
                    className="w-full text-xs border border-neutral-250 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">Teléfono Móvil / Fijo:</label>
                  <input
                    type="tel" required
                    value={profileTelefono}
                    onChange={(e) => setProfileTelefono(e.target.value)}
                    placeholder="+34 612 345 678"
                    className="w-full text-xs border border-neutral-250 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">Documento (DNI/NIE/Pasaporte):</label>
                  <input
                    type="text" required
                    value={profileDocumento}
                    onChange={(e) => setProfileDocumento(e.target.value)}
                    placeholder="Ej: 12345678A"
                    className="w-full text-xs border border-neutral-250 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 font-mono"
                  />
                </div>

                <div className="col-span-2 border-t border-neutral-100 pt-3 mt-1">
                  <label className="text-[11px] font-bold text-amber-750 uppercase tracking-wide block mb-1">🔐 Cambiar Clave de Acceso:</label>
                  <input
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    placeholder="Deje en blanco para conservar su clave de acceso habitual"
                    className="w-full text-xs border border-neutral-250 p-2.5 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 font-sans bg-amber-50/10 placeholder-neutral-400 font-semibold"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">Al ingresar una nueva clave, se modificará su acceso y recibirá una notificación de seguridad por correo.</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button" onClick={() => setShowProfileModal(false)}
                  className="w-1/2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* FORCED PASSWORD CHANGE SCREEN (ONLY FOR FIRST LOGIN OR RESET BY ADMIN) */}
      {activeUser && activeUser.debeCambiarPassword && !isLoggedOut && (
        <div className="fixed inset-0 bg-[#0f172a]/95 flex items-center justify-center p-4 z-[99999] backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-neutral-100 flex flex-col p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
                <Shield className="w-6 h-6 text-amber-600 animate-bounce" />
              </div>
              <h3 className="text-base font-bold text-neutral-850">Cambio de Contraseña Obligatorio</h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Por seguridad y resguardo, es obligatorio actualizar la clave temporal ingresando una nueva clave personalizada antes de usar Roomia PMS.
              </p>
            </div>

            {forcedPassSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
                <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                <span>{forcedPassSuccess}</span>
              </div>
            )}

            {forcedPassError && (
              <div className="bg-red-50 border border-red-200 text-red-850 p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0" />
                <span>{forcedPassError}</span>
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (forcedPassInput.trim().length < 4) {
                setForcedPassError("La contraseña debe componerse de al menos 4 caracteres.");
                return;
              }
              if (forcedPassInput.trim() !== forcedConfirmPassInput.trim()) {
                setForcedPassError("Las contraseñas no coinciden.");
                return;
              }
              setForcedPassLoading(true);
              setForcedPassSuccess("");
              setForcedPassError("");
              try {
                const res = await changeUserPassword(activeUser.id, forcedPassInput.trim(), false);
                if (res.success) {
                  setForcedPassSuccess("¡Contraseña actualizada! Accediendo...");
                  setTimeout(() => {
                    // Success state transitions automatically because activeUser is updated in store
                  }, 1200);
                } else {
                  setForcedPassError(res.error || "Error al actualizar la contraseña.");
                }
              } catch (err: any) {
                setForcedPassError(err.message || String(err));
              } finally {
                setForcedPassLoading(false);
              }
            }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide block">Nueva Contraseña de Acceso:</label>
                <input
                  type="password"
                  required
                  value={forcedPassInput}
                  onChange={(e) => setForcedPassInput(e.target.value)}
                  placeholder="Por favor, ingrese su nueva contraseña"
                  className="w-full text-xs border border-neutral-250 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 font-mono text-center tracking-widest bg-slate-50 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide block">Confirmar Contraseña:</label>
                <input
                  type="password"
                  required
                  value={forcedConfirmPassInput}
                  onChange={(e) => setForcedConfirmPassInput(e.target.value)}
                  placeholder="Re-escriba su contraseña"
                  className="w-full text-xs border border-neutral-250 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 font-mono text-center tracking-widest bg-slate-50 font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={forcedPassLoading || !forcedPassInput.trim() || forcedPassInput !== forcedConfirmPassInput}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:bg-neutral-200 disabled:text-neutral-405 disabled:cursor-not-allowed"
              >
                {forcedPassLoading ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Establecer Nueva Contraseña</span>
                  </>
                )}
              </button>
              
              {forcedPassInput && forcedConfirmPassInput && forcedPassInput !== forcedConfirmPassInput && (
                <p className="text-[10px] text-red-500 text-center font-semibold">Las contraseñas no coinciden.</p>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
