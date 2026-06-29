/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { useHotelStore, compressImage } from './store';
import { supabase } from './supabase';
import ClientView from './components/ClientView';
import ReceptionView from './components/ReceptionView';
import SupportChatDrawer from './components/SupportChatDrawer';
import AdminView from './components/AdminView';
import LoginView from './components/LoginView';
import LandingPageView from './components/LandingPageView';
import LegalPageView, { LegalDocType } from './components/LegalPageView';
import { InteractiveContainer } from './components/InteractiveContainer';
import { BrandLogo } from './components/BrandLogo';
import { LayoutDashboard, Users, User as UserIcon, CalendarDays, KeyRound, Star, Sparkles, Building2, ShieldAlert, LogOut, Edit3, Camera, Check, X, Shield, AlertCircle, Eye, EyeOff, Briefcase, LogIn, Key } from 'lucide-react';
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
    updateUserHotels,
    toggleUserStatus,
    registerUser,
    updateUserProfile,
    changeUserPassword,
    createReservation,
    cancelReservation,
    deleteReservation,
    updateReservationStatus,
    messages = [],
    transactions = [],
    sendChatMessage,
    markMessagesAsRead,
    addPaymentTransaction,
    reviews = [],
    submitReview,
    roomPriceVariations = [],
    saveRoomPriceVariation,
    deleteRoomPriceVariation
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFullLoginScreen, setShowFullLoginScreen] = useState(false);
  const [openHotelId, setOpenHotelId] = useState<string | null>(null);
  const [viewOverride, setViewOverride] = useState<'admin' | 'reception' | null>(null);

  const guestUser = {
    id: 'guest',
    nombre: 'Invitado',
    apellido: '',
    email: 'invitado@roomia.com',
    telefono: '',
    documento: '',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=facearea&facepad=2&q=80',
    rol: 'cliente' as const,
    fechaRegistro: '2026-06-29',
    estado: 'activo' as const
  };

  // Legal documentation active routing state
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(() => {
    const path = window.location.pathname;
    if (path === '/terminos-y-condiciones') return 'terminos';
    if (path === '/politica-de-privacidad') return 'privacidad';
    if (path === '/politica-de-cancelaciones-y-reembolsos') return 'cancelaciones';
    return null;
  });

  // Keep track of back/forward navigation for legal routes
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/terminos-y-condiciones') setActiveLegalDoc('terminos');
      else if (path === '/politica-de-privacidad') setActiveLegalDoc('privacidad');
      else if (path === '/politica-de-cancelaciones-y-reembolsos') setActiveLegalDoc('cancelaciones');
      else setActiveLegalDoc(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  // Inactivity tracking: 15 minutes session timeout
  useEffect(() => {
    // If the user is logged out or activeUser doesn't exist, don't watch for inactivity
    if (isLoggedOut || !activeUser) return;

    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
    let inactivityTimer: any;

    const performAutomaticLogout = async () => {
      console.log("⏱️ Sesión expirada por inactividad (15 minutos). Cerrando sesión...");
      await handleLogout();
    };

    const resetInactivityTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      inactivityTimer = setTimeout(performAutomaticLogout, INACTIVITY_LIMIT_MS);
    };

    // Listen to user activity indicators
    const userEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    userEvents.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });

    // Start initial timer
    resetInactivityTimer();

    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      userEvents.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [isLoggedOut, activeUser]);

  // Custom non-blocking safe toasts/alerts state
  const [toasts, setToasts] = useState<{ id: string; message: string; type?: 'info' | 'success' | 'warning' }[]>([]);

  useEffect(() => {
    const handleAlertEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>;
      const message = customEvent.detail?.message || '';
      if (!message) return;

      const id = Math.random().toString(36).substring(2, 9);
      // Try to determine toast type based on text content
      let type: 'info' | 'success' | 'warning' = 'info';
      if (message.includes('✅') || message.toLowerCase().includes('éxito') || message.toLowerCase().includes('exitosamente')) {
        type = 'success';
      } else if (message.includes('⚠️') || message.includes('❌') || message.toLowerCase().includes('error') || message.toLowerCase().includes('alerta')) {
        type = 'warning';
      }

      setToasts(prev => [...prev, { id, message, type }]);

      // Auto-remove toast after 4.5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4500);
    };

    window.addEventListener('aura-toast', handleAlertEvent);
    return () => window.removeEventListener('aura-toast', handleAlertEvent);
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

  // Password visibility state toggles
  const [showProfilePass, setShowProfilePass] = useState(false);
  const [showForcedPass, setShowForcedPass] = useState(false);
  const [showForcedConfirmPass, setShowForcedConfirmPass] = useState(false);

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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('⚠️ Supabase signOut error:', err);
    }
    // Purge local storage current user ID
    localStorage.removeItem('aura_hotel_pms_current_user_id');
    // Clear any potential pending draft registration data
    localStorage.removeItem('aura_hotel_pms_pending_draft_user');
    
    // Switch the session in the store to empty string to reset activeUser state to null
    switchSessionUser('');
    
    setIsLoggedOut(true);
    setShowLandingPage(false);
    setShowFullLoginScreen(false);
    setShowAuthModal(false);
  };

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

  if (activeLegalDoc !== null) {
    return (
      <LegalPageView
        documentType={activeLegalDoc}
        onClose={() => {
          // If we had an active user session, go back to app, else go back to landing
          window.history.pushState(null, '', '/');
          setActiveLegalDoc(null);
        }}
        onSelectDoc={(type) => setActiveLegalDoc(type)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col font-sans selection:bg-brand-cyan selection:text-[#071726]">
      
      {/* 2. Global application Header */}
      {!showLandingPage && (
        <header className="bg-[#0E2A47] border-b border-brand-cyan/25 shadow-md print:hidden">
          <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
            
            <div className="flex items-center gap-2.5 navbar-logo-container">
              <BrandLogo size="lg" showText={true} lightText={true} />
            </div>

            {/* Current Persona signature badge */}
            {!isLoggedOut ? (
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                {(activeUser.rol === 'hotel_admin' || activeUser.rol === 'super_admin') && (
                  <button
                    onClick={() => {
                      setViewOverride(prev => prev === 'reception' ? 'admin' : 'reception');
                    }}
                    className="h-10 px-3 bg-[#071726] hover:bg-[#0c263d] text-brand-cyan border border-brand-cyan/25 hover:border-brand-cyan/50 rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-2 active:scale-95 shadow-sm font-sans"
                    title="Alternar entre panel de control administrativo y panel de recepcionista operativo"
                  >
                    {viewOverride === 'reception' ? (
                      <>
                        <span>💼</span>
                        <span className="hidden sm:inline">Módulo Admin</span>
                      </>
                    ) : (
                      <>
                        <span>🛎️</span>
                        <span className="hidden sm:inline">Recepción (Check-In)</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={openProfileModal}
                  className="h-10 px-3 bg-[#071726] hover:bg-[#0c263d] text-white border border-brand-cyan/25 hover:border-brand-cyan/50 rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-3 active:scale-95 shadow-sm font-sans group"
                  title="Haga clic para editar sus datos personales y de contacto o cambiar la foto de su perfil"
                >
                  <div className="text-right hidden sm:block">
                    <span className="font-semibold text-white text-xs block leading-none group-hover:text-brand-cyan transition-colors">{activeUser.nombre} {activeUser.apellido}</span>
                  </div>
                  <div className="relative">
                     <img
                      src={activeUser.avatar}
                      alt={activeUser.nombre}
                      className="w-7 h-7 rounded-full border border-brand-cyan/30 shrink-0 shadow group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-brand-cyan text-[#071726] rounded-full p-0.5 border border-[#0E2A47] shadow scale-90 group-hover:scale-100 transition-transform">
                      <Edit3 className="w-2 h-2" />
                    </div>
                  </div>
                </button>
                <button
                  onClick={handleLogout}
                  title="Cerrar Sesión"
                  className="h-10 px-3 bg-red-950/40 hover:bg-red-900/40 text-red-300 hover:text-red-250 border border-red-900/40 hover:border-red-800/50 rounded-xl transition-all cursor-pointer text-xs font-bold flex items-center gap-2 active:scale-95 shadow-sm font-sans"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-300" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFullLoginScreen(true)}
                  className="px-3.5 py-2.5 sm:px-4 bg-brand-cyan hover:bg-[#2fc4f7] text-[#071726] text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-cyan/10 flex items-center gap-2 cursor-pointer hover:scale-[1.03] active:scale-95 shrink-0"
                  title="Iniciar Sesión"
                >
                  <Key className="w-4 h-4 text-[#071726]" />
                  <span className="hidden sm:inline">Iniciar Sesión</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLandingPage(true)}
                  className="px-3.5 py-2.5 sm:px-4 bg-[#0E2A47] hover:bg-[#133A62] border border-brand-cyan/30 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-brand-cyan/5 flex items-center gap-2 cursor-pointer hover:scale-[1.03] active:scale-95 shrink-0"
                  title="Ser Anfitrión"
                >
                  <span className="text-sm">💼</span>
                  <span className="hidden sm:inline">Ser Anfitrión</span>
                </button>
              </div>
            )}

          </div>
        </header>
      )}

      {/* 3. Panel Container with responsive grid animations */}
      {showLandingPage ? (
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <LandingPageView 
              onClose={() => setShowLandingPage(false)} 
              onOpenLegal={(type) => {
                window.history.pushState(null, '', type === 'terminos' ? '/terminos-y-condiciones' : type === 'privacidad' ? '/politica-de-privacidad' : '/politica-de-cancelaciones-y-reembolsos');
                setActiveLegalDoc(type);
              }}
            />
          </AnimatePresence>
        </main>
      ) : showFullLoginScreen ? (
        <main className="flex-1 pb-16">
          <AnimatePresence mode="wait">
            <motion.div
              key="login-screen-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <div className="max-w-4xl mx-auto px-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowFullLoginScreen(false)}
                  className="mb-4 px-4 py-2 bg-neutral-200 hover:bg-neutral-350 text-neutral-800 text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 active:scale-95"
                >
                  ← Regresar al Catálogo de Hoteles
                </button>
              </div>
              <LoginView
                users={users}
                onLoginSuccess={(uid, fetchedUser) => {
                  switchSessionUser(uid, fetchedUser);
                  setIsLoggedOut(false);
                  setShowFullLoginScreen(false);
                }}
                onRegisterUser={registerUser}
                onShowLanding={() => setShowFullLoginScreen(false)}
              />
            </motion.div>
          </AnimatePresence>
        </main>
      ) : (
        <main className="flex-1 pb-16">
          <AnimatePresence mode="wait">
            <motion.div
              key={isLoggedOut ? 'guest-view' : activeUser.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {isLoggedOut ? (
                <ClientView
                  hotels={hotels}
                  rooms={rooms}
                  reservations={reservations}
                  users={users}
                  activeUser={guestUser}
                  onCreateReservation={createReservation}
                  onCancelReservation={cancelReservation}
                  onDeleteReservation={deleteReservation}
                  transactions={transactions}
                  onAddPaymentTransaction={addPaymentTransaction}
                  onOpenHotelChange={setOpenHotelId}
                  reviews={reviews}
                  onSubmitReview={submitReview}
                  roomPriceVariations={roomPriceVariations}
                  onTriggerLogin={() => setShowFullLoginScreen(true)}
                  onTriggerBookingAuth={() => setShowAuthModal(true)}
                />
              ) : (
                <>
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
                      transactions={transactions}
                      onAddPaymentTransaction={addPaymentTransaction}
                      onOpenHotelChange={setOpenHotelId}
                      reviews={reviews}
                      onSubmitReview={submitReview}
                      roomPriceVariations={roomPriceVariations}
                    />
                  )}

                  {(activeUser.rol === 'recepcionista' || ((activeUser.rol === 'hotel_admin' || activeUser.rol === 'super_admin') && viewOverride === 'reception')) && (
                    <ReceptionView
                      hotels={hotels}
                      rooms={rooms}
                      reservations={reservations}
                      activeUser={activeUser}
                      onPerformCheckIn={store.performCheckIn}
                      onPerformCheckOut={store.performCheckOut}
                      onUpdateRoomStatus={updateRoomStatus}
                      onUpdateReservationStatus={updateReservationStatus}
                      users={users}
                      onAddLog={handleAddLogSimulated}
                      onCreateReservation={createReservation}
                      onRegisterUser={registerUser}
                      roomPriceVariations={roomPriceVariations}
                    />
                  )}

                  {((activeUser.rol === 'hotel_admin' || activeUser.rol === 'super_admin') && viewOverride !== 'reception') && (
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
                      onUpdateUserHotels={updateUserHotels}
                      onToggleUserStatus={toggleUserStatus}
                      onChangeUserPassword={changeUserPassword}
                      statistics={stats}
                      onUpdateRoomStatus={updateRoomStatus}
                      onUpdateReservationStatus={updateReservationStatus}
                      onSyncAllToSupabase={store.syncAllToSupabase}
                      reviews={reviews}
                      roomPriceVariations={roomPriceVariations}
                      onSaveRoomPriceVariation={saveRoomPriceVariation}
                      onDeleteRoomPriceVariation={deleteRoomPriceVariation}
                    />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      )}

      {/* AUTHENTICATION OVERLAY MODAL FOR GUEST CHECKOUT/BOOKINGS */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-neutral-950/70 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm animate-fade-in print:hidden">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden animate-scale-up">
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-2 rounded-full hover:bg-neutral-100 transition-colors z-50 cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="max-h-[85vh] overflow-y-auto p-4 md:p-6">
              <div className="text-center mb-4 mt-2">
                <p className="text-xs text-teal-600 font-bold uppercase tracking-widest bg-teal-50 px-3 py-1 rounded-full inline-block">Paso Requerido 🔒</p>
                <h3 className="text-lg font-bold text-neutral-800 mt-1">Identificación del Huésped</h3>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto mt-0.5">Inicie sesión o regístrese para continuar con su reserva y emitir su comprobante.</p>
              </div>
              <LoginView
                users={users}
                onlyForm={true}
                onLoginSuccess={(uid, fetchedUser) => {
                  switchSessionUser(uid, fetchedUser);
                  setIsLoggedOut(false);
                  setShowAuthModal(false);
                }}
                onRegisterUser={registerUser}
                onShowLanding={() => {
                  setShowAuthModal(false);
                  setShowLandingPage(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Tiny visual footer */}
      <footer className="py-12 border-t border-[#0E2A47] text-center text-[11px] font-mono print:hidden space-y-4 bg-[#071726] text-[#A8B2BD]">
        <p className="text-white/80 font-semibold select-none">©2026 Roomia PMS — Maqyasoft</p>
        <p className="text-white/40 text-[10px]">Hora Ecuador (GMT-5): {ecuadorTime || 'Cargando...'}</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-sans font-medium pt-2">
          <button
            type="button"
            onClick={() => {
              window.history.pushState(null, '', '/terminos-y-condiciones');
              setActiveLegalDoc('terminos');
            }}
            className="hover:text-[#23B4E6] transition-colors cursor-pointer text-slate-300"
            id="footer-link-terminos"
          >
            Términos y Condiciones
          </button>
          <span className="text-slate-700 font-sans select-none">•</span>
          <button
            type="button"
            onClick={() => {
              window.history.pushState(null, '', '/politica-de-privacidad');
              setActiveLegalDoc('privacidad');
            }}
            className="hover:text-[#23B4E6] transition-colors cursor-pointer text-slate-300"
            id="footer-link-privacidad"
          >
            Política de Privacidad
          </button>
          <span className="text-slate-700 font-sans select-none">•</span>
          <button
            type="button"
            onClick={() => {
              window.history.pushState(null, '', '/politica-de-cancelaciones-y-reembolsos');
              setActiveLegalDoc('cancelaciones');
            }}
            className="hover:text-[#23B4E6] transition-colors cursor-pointer text-slate-300"
            id="footer-link-cancelaciones"
          >
            Política de Cancelación y Reembolsos
          </button>
        </div>
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
                            if (file.size > 15 * 1024 * 1024) {
                              alert("La imagen es demasiado grande. Intente con una imagen más liviana.");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              if (event.target?.result) {
                                const compressed = await compressImage(event.target.result as string, 500, 500, 0.7);
                                setProfileAvatar(compressed);
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
                  <div className="relative">
                    <input
                      type={showProfilePass ? "text" : "password"}
                      value={profilePassword}
                      onChange={(e) => setProfilePassword(e.target.value)}
                      placeholder="Deje en blanco para conservar su clave de acceso habitual"
                      className="w-full text-xs border border-neutral-250 p-2.5 pr-10 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 font-sans bg-amber-50/10 placeholder-neutral-400 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowProfilePass(!showProfilePass)}
                      className="absolute right-3 top-3 p-0.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      {showProfilePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
                <div className="relative">
                  <input
                    type={showForcedPass ? "text" : "password"}
                    required
                    value={forcedPassInput}
                    onChange={(e) => setForcedPassInput(e.target.value)}
                    placeholder="Por favor, ingrese su nueva contraseña"
                    className="w-full text-xs border border-neutral-250 p-2.5 pr-10 rounded-xl focus:outline-none focus:border-teal-500 font-mono text-center tracking-widest bg-slate-50 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForcedPass(!showForcedPass)}
                    className="absolute right-3 top-3 p-0.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                  >
                    {showForcedPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide block">Confirmar Contraseña:</label>
                <div className="relative">
                  <input
                    type={showForcedConfirmPass ? "text" : "password"}
                    required
                    value={forcedConfirmPassInput}
                    onChange={(e) => setForcedConfirmPassInput(e.target.value)}
                    placeholder="Re-escriba su contraseña"
                    className="w-full text-xs border border-neutral-250 p-2.5 pr-10 rounded-xl focus:outline-none focus:border-teal-500 font-mono text-center tracking-widest bg-slate-50 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForcedConfirmPass(!showForcedConfirmPass)}
                    className="absolute right-3 top-3 p-0.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                  >
                    {showForcedConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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

      {/* Real-time Global Support Chat Component Drawer - Only visible once user has logged in */}
      {activeUser && !isLoggedOut && (
        <SupportChatDrawer
          hotels={hotels}
          activeUser={activeUser}
          messages={messages}
          onSendMessage={sendChatMessage}
          onMarkAsRead={markMessagesAsRead}
          openHotelId={openHotelId}
        />
      )}

      {/* Modern Safe Toast Notifications Overlay */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none print:hidden">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`p-4 rounded-2xl shadow-xl border text-xs font-semibold backdrop-blur-md pointer-events-auto flex items-start gap-3 justify-between ${
                toast.type === 'success'
                  ? 'bg-teal-600/95 border-teal-500 text-white'
                  : toast.type === 'warning'
                  ? 'bg-amber-600/95 border-amber-500 text-white'
                  : 'bg-neutral-900/95 border-neutral-800 text-white'
              }`}
            >
              <div className="flex-1 leading-relaxed">
                {toast.message}
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-white/60 hover:text-white transition-colors cursor-pointer p-0.5 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
