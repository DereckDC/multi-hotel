/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useRef } from 'react';
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
import { LayoutDashboard, Users, User as UserIcon, CalendarDays, KeyRound, Star, Sparkles, Building2, ShieldAlert, LogOut, Edit3, Camera, Check, X, Shield, AlertCircle, Eye, EyeOff, Briefcase, LogIn, Key, Menu, Home, Compass, DollarSign, ClipboardList, QrCode, Calendar, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Slugify helper to convert hotel/property names to clean URL paths
const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // remove accents
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/[^\w\-]+/g, '') // remove non-alphanumeric chars (except hyphens)
    .replace(/\-\-+/g, '-') // collapse multiple hyphens
    .replace(/^-+/, '') // trim leading hyphens
    .replace(/-+$/, ''); // trim trailing hyphens
};

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
    deleteRoomPriceVariation,
    isInitialSyncing
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

  const [showLandingPage, setShowLandingPage] = useState(() => {
    return typeof window !== 'undefined' && window.location.pathname === '/landingpage';
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFullLoginScreen, setShowFullLoginScreen] = useState(false);
  const [openHotelId, setOpenHotelId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path === '/' || !path || path === '' || path === '/landingpage' || path === '/terminos-y-condiciones' || path === '/politica-de-privacidad' || path === '/politica-de-cancelaciones-y-reembolsos') {
      return null;
    }
    const slug = path.substring(1);
    const matchedHotel = hotels.find(h => slugify(h.nombre) === slug);
    return matchedHotel ? matchedHotel.id : null;
  });
  const [invalidUrlError, setInvalidUrlError] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    if (path === '/' || !path || path === '' || path === '/landingpage' || path === '/terminos-y-condiciones' || path === '/politica-de-privacidad' || path === '/politica-de-cancelaciones-y-reembolsos') {
      return false;
    }
    const slug = path.substring(1);
    const matchedHotel = hotels.find(h => slugify(h.nombre) === slug);
    return !matchedHotel;
  });
  const prevOpenHotelIdRef = useRef<string | null>(openHotelId);
  const [viewOverride, setViewOverride] = useState<'admin' | 'reception' | null>(null);

  // Track offline status in real time
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      window.dispatchEvent(new CustomEvent('aura-toast', { detail: { message: '✅ Conexión restablecida de forma automática' } }));
    };
    const handleOffline = () => {
      setIsOffline(true);
      window.dispatchEvent(new CustomEvent('aura-toast', { detail: { message: '⚠️ Se ha perdido la conexión a internet' } }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const switchSessionUserRef = useRef(switchSessionUser);
  useEffect(() => {
    switchSessionUserRef.current = switchSessionUser;
  }, [switchSessionUser]);

  // Listen to Supabase auth state changes to synchronize active user session and isLoggedOut status
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔑 Supabase Auth Event: ${event}`);
      if (session?.user) {
        // Authenticated
        localStorage.setItem('aura_hotel_pms_current_user_id', JSON.stringify(session.user.id));
        switchSessionUserRef.current(session.user.id);
        setIsLoggedOut(false);
      } else if (event === 'SIGNED_OUT') {
        // Explicitly logged out
        localStorage.removeItem('aura_hotel_pms_current_user_id');
        switchSessionUserRef.current('');
        setIsLoggedOut(true);
      } else {
        // Initial session or token event without session: check saved local session
        try {
          const saved = localStorage.getItem('aura_hotel_pms_current_user_id');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed) {
              switchSessionUserRef.current(parsed);
              setIsLoggedOut(false);
            } else {
              setIsLoggedOut(true);
            }
          } else {
            setIsLoggedOut(true);
          }
        } catch {
          setIsLoggedOut(true);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Left Sidebar Menu navigation state variables
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [clientTab, setClientTab] = useState<'explore' | 'properties' | 'reservations'>(() => {
    if (typeof window === 'undefined') return 'explore';
    const path = window.location.pathname;
    if (path === '/' || !path || path === '' || path === '/landingpage' || path === '/terminos-y-condiciones' || path === '/politica-de-privacidad' || path === '/politica-de-cancelaciones-y-reembolsos') {
      return 'explore';
    }
    const slug = path.substring(1);
    const matchedHotel = hotels.find(h => slugify(h.nombre) === slug);
    if (matchedHotel && matchedHotel.tipoEstablecimiento === 'propiedad') {
      return 'properties';
    }
    return 'explore';
  });
  const [adminActiveTab, setAdminActiveTab] = useState<'dashboard' | 'hotels' | 'properties' | 'rooms' | 'users' | 'logs' | 'reservations' | 'refunds' | 'incidents'>('dashboard');
  const [receptionActiveTab, setReceptionActiveTab] = useState<'checkin' | 'registro' | 'incidencias'>('checkin');

  const isSidebarActive = !showLandingPage && !showFullLoginScreen;

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

  // Synchronize browser URL with openHotelId
  useEffect(() => {
    const path = window.location.pathname;
    // Don't modify if we're on a legal document page or landing page
    if (path === '/terminos-y-condiciones' || path === '/politica-de-privacidad' || path === '/politica-de-cancelaciones-y-reembolsos' || path === '/landingpage') {
      prevOpenHotelIdRef.current = openHotelId;
      return;
    }

    if (openHotelId) {
      const hotel = hotels.find(h => h.id === openHotelId);
      if (hotel) {
        const slug = slugify(hotel.nombre);
        if (path !== `/${slug}`) {
          window.history.pushState(null, '', `/${slug}`);
        }
      }
    } else {
      // Only redirect to '/' if we just closed a hotel (transitioned from some-id to null)
      if (prevOpenHotelIdRef.current !== null) {
        const isHotelPath = hotels.some(h => `/${slugify(h.nombre)}` === path);
        if (path !== '/' && (isHotelPath || path.length > 1)) {
          window.history.pushState(null, '', '/');
        }
      }
    }
    prevOpenHotelIdRef.current = openHotelId;
  }, [openHotelId, hotels]);

  // Synchronize browser URL with showLandingPage
  useEffect(() => {
    const path = window.location.pathname;
    if (showLandingPage) {
      if (path !== '/landingpage') {
        window.history.pushState(null, '', '/landingpage');
      }
    } else {
      if (path === '/landingpage') {
        window.history.pushState(null, '', '/');
      }
    }
  }, [showLandingPage]);

  // Handle page load and popstate routing for legal documents, landing page, and hotels
  useEffect(() => {
    const handleRouting = () => {
      const path = window.location.pathname;
      if (path === '/terminos-y-condiciones') {
        setActiveLegalDoc('terminos');
        setInvalidUrlError(false);
      } else if (path === '/politica-de-privacidad') {
        setActiveLegalDoc('privacidad');
        setInvalidUrlError(false);
      } else if (path === '/politica-de-cancelaciones-y-reembolsos') {
        setActiveLegalDoc('cancelaciones');
        setInvalidUrlError(false);
      } else if (path === '/landingpage') {
        setActiveLegalDoc(null);
        setShowLandingPage(true);
        setOpenHotelId(null);
        setInvalidUrlError(false);
      } else {
        setActiveLegalDoc(null);
        setShowLandingPage(false);
        if (path === '/' || !path || path === '') {
          setOpenHotelId(null);
          setInvalidUrlError(false);
        } else {
          const slug = path.substring(1);
          const matchedHotel = hotels.find(h => slugify(h.nombre) === slug);
          if (matchedHotel) {
            setShowLandingPage(false);
            setOpenHotelId(matchedHotel.id);
            setInvalidUrlError(false);
            if (matchedHotel.tipoEstablecimiento === 'propiedad') {
              setClientTab('properties');
            } else {
              setClientTab('explore');
            }
          } else {
            setOpenHotelId(null);
            setInvalidUrlError(true);
          }
        }
      }
    };

    // Run once on load and when hotels change
    handleRouting();

    window.addEventListener('popstate', handleRouting);
    return () => window.removeEventListener('popstate', handleRouting);
  }, [hotels]);

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
    if (isLoggedOut || !activeUser) {
      localStorage.removeItem('roomia_last_activity');
      return;
    }

    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
    let inactivityTimer: any;

    const performAutomaticLogout = async () => {
      console.log("⏱️ Sesión expirada por inactividad. Cerrando sesión...");
      localStorage.removeItem('roomia_last_activity');
      await handleLogout();
    };

    const checkInactivity = () => {
      const lastActivityStr = localStorage.getItem('roomia_last_activity');
      if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        if (!isNaN(lastActivity) && Date.now() - lastActivity >= INACTIVITY_LIMIT_MS) {
          performAutomaticLogout();
          return true;
        }
      }
      return false;
    };

    const resetInactivityTimer = () => {
      localStorage.setItem('roomia_last_activity', Date.now().toString());
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      inactivityTimer = setTimeout(performAutomaticLogout, INACTIVITY_LIMIT_MS);
    };

    // Initialize/check on mount
    const expired = checkInactivity();
    if (!expired) {
      resetInactivityTimer();
    }

    // Check periodically (every 5 seconds) to catch timeouts even if events aren't firing
    const checkInterval = setInterval(() => {
      checkInactivity();
    }, 5000);

    // Listen to user activity indicators
    const userEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    userEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    // Handle visibility changes (e.g. mobile lock, switching tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      clearInterval(checkInterval);
      userEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
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
    
    // Reload the page to reset in-memory states and ensure data is synchronized from Supabase
    window.location.reload();
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

  if (isInitialSyncing) {
    return (
      <div className="min-h-screen bg-[#071726] flex flex-col items-center justify-center p-6 text-white relative overflow-hidden select-none">
        {/* Ambient background glows */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#23B4E6]/5 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-[#23B4E6]/5 blur-[120px] pointer-events-none" />

        <div className="flex flex-col items-center gap-6 max-w-sm text-center relative z-10">
          <div className="p-4 bg-[#071726]/80 border border-[#23B4E6]/20 rounded-2xl shadow-xl shadow-[#23B4E6]/5 flex items-center justify-center animate-pulse">
            <BrandLogo size="lg" showText={false} lightText={true} />
          </div>

          <div className="space-y-2 mt-4">
            <h2 className="text-lg font-semibold text-white tracking-wide flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 text-[#23B4E6] animate-spin" />
              <span>Estableciendo Conexión</span>
            </h2>
            <p className="text-xs text-slate-400">
              Sincronizando base de datos en tiempo real...
            </p>
          </div>
        </div>
      </div>
    );
  }

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
        <header className="bg-slate-950 border-b border-slate-900 shadow-md print:hidden w-full sticky top-0 z-40">
          <div className={`w-full px-6 h-20 flex items-center justify-between transition-all duration-300 ${
            isSidebarActive 
              ? (sidebarOpen || sidebarHovered ? 'md:pl-[17rem]' : 'md:pl-[5rem]') 
              : ''
          }`}>
            
            <div className="flex items-center gap-2 navbar-logo-container">
              {!showFullLoginScreen && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(prev => !prev)}
                  className="p-2 text-[#23B4E6] hover:text-white bg-[#071726]/40 hover:bg-[#071726]/80 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center mr-1 shadow border border-brand-cyan/20 md:hidden"
                  title="Menú de Navegación"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <BrandLogo size="lg" showText={true} lightText={true} />
            </div>

            {showFullLoginScreen && (
              <button
                type="button"
                onClick={() => {
                  setShowFullLoginScreen(false);
                  setClientTab('explore');
                  setOpenHotelId(null);
                }}
                className="px-4 py-2 bg-[#0E2A47] hover:bg-[#133A62] border border-brand-cyan/30 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-brand-cyan/5 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 text-brand-cyan" />
                <span>Volver</span>
              </button>
            )}

            {/* Current Persona signature badge removed as requested since they are in the menu */}

          </div>
        </header>
      )}

      {/* 3. Panel Container with responsive grid animations */}
      {showLandingPage ? (
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <LandingPageView 
              onClose={() => {
                setShowLandingPage(false);
                setClientTab('explore');
                setOpenHotelId(null);
              }} 
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
              <div className="pt-8">
                <LoginView
                  users={users}
                  onLoginSuccess={(uid, fetchedUser) => {
                    switchSessionUser(uid, fetchedUser);
                    setIsLoggedOut(false);
                    setShowFullLoginScreen(false);
                    // Save user ID to localStorage immediately and reload the page to ensure complete sync with Supabase
                    localStorage.setItem('aura_hotel_pms_current_user_id', uid);
                    window.location.reload();
                  }}
                  onRegisterUser={registerUser}
                  onShowLanding={() => {
                    setShowFullLoginScreen(false);
                    setClientTab('explore');
                    setOpenHotelId(null);
                  }}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      ) : (
        (() => {
          const currentRole = isLoggedOut || !activeUser ? 'cliente' : activeUser.rol;
          const menuItems: {
            icon: any;
            label: string;
            active: boolean;
            onClick: () => void;
            colorClass?: string;
          }[] = [];

          if (currentRole === 'cliente') {
            menuItems.push(
              {
                icon: Compass,
                label: "Explorar Hoteles",
                active: clientTab === 'explore' && openHotelId === null,
                onClick: () => { setClientTab('explore'); setOpenHotelId(null); setSidebarOpen(false); }
              },
              {
                icon: Home,
                label: "Propiedades",
                active: clientTab === 'properties' && openHotelId === null,
                onClick: () => { setClientTab('properties'); setOpenHotelId(null); setSidebarOpen(false); }
              },
              {
                icon: CalendarDays,
                label: "Mis Reservas",
                active: clientTab === 'reservations',
                onClick: () => { setClientTab('reservations'); setOpenHotelId(null); setSidebarOpen(false); }
              }
            );

            if (!isLoggedOut) {
              menuItems.push(
                {
                  icon: UserIcon,
                  label: "Mi Perfil",
                  active: false,
                  onClick: () => { openProfileModal(); setSidebarOpen(false); }
                },
                {
                  icon: Briefcase,
                  label: "Ser Anfitrión",
                  active: false,
                  onClick: () => { setShowLandingPage(true); setSidebarOpen(false); }
                },
                {
                  icon: LogOut,
                  label: "Cerrar Sesión",
                  active: false,
                  onClick: () => { handleLogout(); setSidebarOpen(false); },
                  colorClass: "text-red-400 hover:text-red-350 hover:bg-red-950/20"
                }
              );
            } else {
              menuItems.push(
                {
                  icon: LogIn,
                  label: "Iniciar Sesión",
                  active: false,
                  onClick: () => { setShowFullLoginScreen(true); setSidebarOpen(false); }
                },
                {
                  icon: Briefcase,
                  label: "Ser Anfitrión",
                  active: false,
                  onClick: () => { setShowLandingPage(true); setSidebarOpen(false); }
                }
              );
            }
          } else if (currentRole === 'recepcionista' || ((currentRole === 'hotel_admin' || currentRole === 'super_admin') && viewOverride === 'reception')) {
            if (currentRole === 'hotel_admin' || currentRole === 'super_admin') {
              menuItems.push({
                icon: Shield,
                label: "Ir a Módulo Admin",
                active: false,
                onClick: () => { setViewOverride('admin'); setSidebarOpen(false); },
                colorClass: "text-amber-400 hover:text-amber-300 hover:bg-amber-950/20"
              });
            }

            menuItems.push(
              {
                icon: QrCode,
                label: "Check-In / QR",
                active: receptionActiveTab === 'checkin',
                onClick: () => { setReceptionActiveTab('checkin'); setSidebarOpen(false); }
              },
              {
                icon: Calendar,
                label: "Registro / Walk-In",
                active: receptionActiveTab === 'registro',
                onClick: () => { setReceptionActiveTab('registro'); setSidebarOpen(false); }
              },
              {
                icon: ShieldAlert,
                label: "Incidencias",
                active: receptionActiveTab === 'incidencias',
                onClick: () => { setReceptionActiveTab('incidencias'); setSidebarOpen(false); }
              },
              {
                icon: UserIcon,
                label: "Mi Perfil",
                active: false,
                onClick: () => { openProfileModal(); setSidebarOpen(false); }
              },
              {
                icon: LogOut,
                label: "Cerrar Sesión",
                active: false,
                onClick: () => { handleLogout(); setSidebarOpen(false); },
                colorClass: "text-red-400 hover:text-red-300 hover:bg-red-950/20"
              }
            );
          } else {
            // Admin views
            menuItems.push({
              icon: Key,
              label: "Ir a Recepción",
              active: false,
              onClick: () => { setViewOverride('reception'); setSidebarOpen(false); },
              colorClass: "text-teal-400 hover:text-teal-300 hover:bg-teal-950/20"
            });

            menuItems.push(
              {
                icon: LayoutDashboard,
                label: "Dashboard",
                active: adminActiveTab === 'dashboard',
                onClick: () => { setAdminActiveTab('dashboard'); setSidebarOpen(false); }
              },
              {
                icon: Building2,
                label: "Hoteles",
                active: adminActiveTab === 'hotels',
                onClick: () => { setAdminActiveTab('hotels'); setSidebarOpen(false); }
              },
              {
                icon: Home,
                label: "Propiedades",
                active: adminActiveTab === 'properties',
                onClick: () => { setAdminActiveTab('properties'); setSidebarOpen(false); }
              },
              {
                icon: KeyRound,
                label: "Habitaciones",
                active: adminActiveTab === 'rooms',
                onClick: () => { setAdminActiveTab('rooms'); setSidebarOpen(false); }
              },
              {
                icon: Users,
                label: "Usuarios",
                active: adminActiveTab === 'users',
                onClick: () => { setAdminActiveTab('users'); setSidebarOpen(false); }
              },
              {
                icon: CalendarDays,
                label: "Reservas",
                active: adminActiveTab === 'reservations',
                onClick: () => { setAdminActiveTab('reservations'); setSidebarOpen(false); }
              },
              {
                icon: DollarSign,
                label: "Reembolsos",
                active: adminActiveTab === 'refunds',
                onClick: () => { setAdminActiveTab('refunds'); setSidebarOpen(false); }
              },
              {
                icon: ShieldAlert,
                label: "Incidencias",
                active: adminActiveTab === 'incidents',
                onClick: () => { setAdminActiveTab('incidents'); setSidebarOpen(false); }
              },
              {
                icon: ClipboardList,
                label: "Bitácora",
                active: adminActiveTab === 'logs',
                onClick: () => { setAdminActiveTab('logs'); setSidebarOpen(false); }
              },
              {
                icon: UserIcon,
                label: "Mi Perfil",
                active: false,
                onClick: () => { openProfileModal(); setSidebarOpen(false); }
              },
              {
                icon: LogOut,
                label: "Cerrar Sesión",
                active: false,
                onClick: () => { handleLogout(); setSidebarOpen(false); },
                colorClass: "text-red-400 hover:text-red-300 hover:bg-red-950/20"
              }
            );
          }

          const renderMenuItems = (isExpanded: boolean) => {
            return menuItems.map((item, index) => {
              const IconComp = item.icon;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full h-11 flex items-center px-3 rounded-xl transition-all cursor-pointer text-xs font-semibold select-none group relative active:scale-95 ${
                    item.active
                      ? 'bg-[#23B4E6] text-[#071726] shadow-md shadow-brand-cyan/15'
                      : item.colorClass || 'text-slate-300 hover:text-white hover:bg-[#071726]/50'
                  }`}
                  title={!isExpanded ? item.label : undefined}
                  id={`sidebar-item-${index}`}
                >
                  <div className="flex items-center justify-center shrink-0 w-5 h-5">
                    <IconComp className="w-5 h-5" />
                  </div>
                  
                  <span
                    className={`whitespace-nowrap transition-all duration-300 font-sans ${
                      isExpanded 
                        ? 'opacity-100 ml-3 block' 
                        : 'opacity-0 hidden'
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Compact Tooltip when collapsed */}
                  {!isExpanded && (
                    <div className="absolute left-16 bg-[#071726] text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap shadow-md border border-brand-cyan/10 z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            });
          };

          return (
            <div className="flex-1 flex flex-row relative min-h-[calc(100vh-5rem)]">
              {/* Back-drop for mobile view when sidebar is open */}
              {sidebarOpen && (
                <div 
                  className="fixed inset-0 bg-neutral-950/50 backdrop-blur-xs z-30 md:hidden"
                  onClick={() => setSidebarOpen(false)}
                  id="sidebar-backdrop"
                />
              )}

              {/* Mobile Menu Dropdown (Open: Slides down from top) */}
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="fixed md:hidden top-20 left-0 right-0 w-full bg-slate-950 border-b border-slate-900 z-40 shadow-2xl overflow-hidden flex flex-col"
                    id="mobile-dropdown-menu"
                  >
                    <div className="py-4 px-4 space-y-1.5 max-h-[70vh] overflow-y-auto">
                      {renderMenuItems(true)}
                    </div>
                    {/* Mobile User Profile indicator at the bottom of dropdown */}
                    <div className="p-4 border-t border-brand-cyan/10 bg-[#071726]/30">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#23B4E6]/10 flex items-center justify-center text-brand-cyan shrink-0">
                          <span className="text-base">🛎️</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {isLoggedOut || !activeUser ? 'Invitado' : `${activeUser.nombre}`}
                          </p>
                          <p className="text-[10px] text-brand-cyan truncate font-mono mt-0.5 uppercase tracking-wider">
                            {isLoggedOut || !activeUser ? 'cliente' : activeUser.rol}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>



              {/* Desktop Sidebar (Always overlaying on the left, full height top to bottom) */}
              <aside
                onMouseEnter={() => setSidebarHovered(true)}
                onMouseLeave={() => setSidebarHovered(false)}
                className={`bg-slate-950 border-r border-slate-900 flex flex-col justify-between transition-all duration-300 shrink-0 z-50 h-screen ${
                  sidebarOpen || sidebarHovered 
                    ? 'w-64' 
                    : 'w-16'
                } fixed top-0 bottom-0 left-0 overflow-hidden print:hidden hidden md:flex`}
                id="sidebar-navigation-desktop"
              >
                {/* Spacer to align beautifully with Header & house the Menu button */}
                <div className={`h-20 flex items-center border-b border-slate-900 shrink-0 transition-all duration-300 ${
                  sidebarOpen || sidebarHovered ? 'px-4' : 'justify-center px-1'
                }`}>
                  {(sidebarOpen || sidebarHovered) ? (
                    <div className="flex items-center gap-3 w-full">
                      <button
                        type="button"
                        onClick={() => setSidebarOpen(prev => !prev)}
                        className="p-1.5 text-brand-cyan hover:text-white bg-[#071726]/40 hover:bg-[#071726]/80 rounded-lg transition-all cursor-pointer active:scale-95 flex items-center justify-center shadow border border-brand-cyan/20 shrink-0"
                        title="Contraer Menú"
                      >
                        <Menu className="w-4 h-4" />
                      </button>
                      <span className="text-brand-cyan text-xs font-black tracking-widest font-mono animate-fade-in select-none">
                        MENÚ
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(prev => !prev)}
                      className="p-2 text-[#23B4E6] hover:text-white bg-[#071726]/40 hover:bg-[#071726]/80 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center shadow border border-brand-cyan/20"
                      title="Expandir Menú"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                  {renderMenuItems(sidebarOpen || sidebarHovered)}
                </div>
                <div className="p-4 border-t border-brand-cyan/10 bg-[#071726]/30">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#23B4E6]/10 flex items-center justify-center text-brand-cyan shrink-0">
                      <span className="text-sm">🛎️</span>
                    </div>
                    {(sidebarOpen || sidebarHovered) && (
                      <div className="min-w-0 transition-opacity duration-300">
                        <p className="text-[10px] font-bold text-[#FFFFFF] truncate leading-none">
                          {isLoggedOut || !activeUser ? 'Invitado' : `${activeUser.nombre}`}
                        </p>
                        <p className="text-[8px] text-brand-cyan truncate font-mono mt-0.5 uppercase tracking-wider">
                          {isLoggedOut || !activeUser ? 'cliente' : activeUser.rol}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </aside>

              {/* Main workspace container with dynamic left padding to account for fixed sidebar */}
              <div className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${
                sidebarOpen || sidebarHovered ? 'md:pl-64' : 'md:pl-16'
              }`}>
                <main className="flex-1 pb-16">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isLoggedOut || !activeUser ? 'guest-view' : activeUser.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      {isLoggedOut || !activeUser ? (
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
                          openHotelId={openHotelId}
                          reviews={reviews}
                          onSubmitReview={submitReview}
                          roomPriceVariations={roomPriceVariations}
                          onTriggerLogin={() => setShowFullLoginScreen(true)}
                          onTriggerBookingAuth={() => setShowAuthModal(true)}
                          activeTab={clientTab}
                          onActiveTabChange={setClientTab}
                          onRefreshCatalog={store.refreshCatalogFromSupabase}
                        />
                      ) : (
                        <>
                          {/* ROLE DISPATCHER ROUTING */}
                          {activeUser?.rol === 'cliente' && (
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
                              openHotelId={openHotelId}
                              reviews={reviews}
                              onSubmitReview={submitReview}
                              roomPriceVariations={roomPriceVariations}
                              activeTab={clientTab}
                              onActiveTabChange={setClientTab}
                              onRefreshCatalog={store.refreshCatalogFromSupabase}
                            />
                          )}

                          {(activeUser?.rol === 'recepcionista' || ((activeUser?.rol === 'hotel_admin' || activeUser?.rol === 'super_admin') && viewOverride === 'reception')) && (
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
                              activeTab={receptionActiveTab}
                              logs={logs}
                            />
                          )}

                          {((activeUser?.rol === 'hotel_admin' || activeUser?.rol === 'super_admin') && viewOverride !== 'reception') && (
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
                              adminTab={adminActiveTab}
                              onAdminTabChange={setAdminActiveTab}
                            />
                          )}
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </main>
              </div>

            </div>
          );
        })()
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
                  // Save user ID to localStorage immediately and reload the page to ensure complete sync with Supabase
                  localStorage.setItem('aura_hotel_pms_current_user_id', uid);
                  window.location.reload();
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
      <footer className={`py-12 border-t border-slate-900 text-center text-[11px] font-mono print:hidden space-y-4 bg-slate-950 text-[#A8B2BD] transition-all duration-300 ${
        isSidebarActive 
          ? (sidebarOpen || sidebarHovered ? 'md:pl-64' : 'md:pl-16') 
          : ''
      }`}>
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
                <p className="text-[10px] text-neutral-400 mt-0.5 uppercase tracking-wide font-mono">Rol actual: {activeUser?.rol ? activeUser.rol.replace('_', ' ') : 'Cliente'}</p>
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
      <div className="fixed bottom-4 sm:bottom-6 right-3 left-3 sm:left-auto sm:right-6 z-[9999] flex flex-col gap-2.5 max-w-md sm:max-w-sm w-auto sm:w-full pointer-events-none print:hidden">
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

      {/* 🔴 OFFLINE UI WARNING SYSTEM */}
      <AnimatePresence>
        {isOffline && (
          <>
            {/* Banner superior flotante para vistas de usuario/cliente o Landing */}
            {(isLoggedOut || !activeUser || activeUser.rol === 'cliente' || showLandingPage) ? (
              <motion.div
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                transition={{ duration: 0.3 }}
                className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-xl bg-amber-950/95 border-2 border-amber-600/80 backdrop-blur-md text-amber-100 p-4 rounded-2xl shadow-2xl flex items-center gap-3 justify-between font-sans shadow-amber-950/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 animate-pulse">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-xs text-white">Modo sin conexión activo</h5>
                    <p className="text-[10px] text-amber-300 leading-tight">La app funciona con datos locales. Los registros y reservas se completarán cuando vuelva el internet.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOffline(!navigator.onLine)}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-[10px] font-black rounded-lg transition-all cursor-pointer shrink-0"
                >
                  Verificar
                </button>
              </motion.div>
            ) : (
              /* Fullscreen block screen for admin/staff views because writing offline creates database conflicts */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4 font-sans"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-6 text-center"
                >
                  <div className="mx-auto w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500 animate-pulse">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white">Sin Conexión a Internet</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Para proteger la base de datos de Roomia y evitar duplicidad o conflictos de reservas en recepción, la interfaz administrativa ha sido suspendida temporalmente.
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-left space-y-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sugerencias operativas:</h4>
                    <ul className="text-[10px] text-slate-400 space-y-1.5 font-semibold">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#23B4E6]" />
                        <span>Verifique que el Wi-Fi o datos móviles estén encendidos</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#23B4E6]" />
                        <span>Desactive y reactive el modo avión de su celular o tablet</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#23B4E6]" />
                        <span>La plataforma se restablecerá sola en cuanto detecte señal</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const online = navigator.onLine;
                      setIsOffline(!online);
                      if (online) {
                        window.dispatchEvent(new CustomEvent('aura-toast', { detail: { message: '✅ Conexión restablecida con éxito' } }));
                      } else {
                        window.dispatchEvent(new CustomEvent('aura-toast', { detail: { message: '⚠️ Aún sin internet. Intente nuevamente.' } }));
                      }
                    }}
                    className="w-full bg-[#23B4E6] hover:bg-[#3fc2f0] active:scale-[0.98] text-slate-950 font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg shadow-brand-cyan/20 cursor-pointer"
                  >
                    Reintentar Conexión 🔄
                  </button>
                </motion.div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* 🚫 INVALID HOTEL/PROPERTY SLUG MODAL OVERLAY */}
      <AnimatePresence>
        {invalidUrlError && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4 font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0E2A47] border-2 border-[#23B4E6]/20 p-8 rounded-3xl max-w-md w-full shadow-2xl text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500">
                <ShieldAlert className="w-8 h-8 text-[#23B4E6]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-white">Establecimiento No Encontrado</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  El hotel o propiedad que estás intentando buscar no existe en nuestro sistema de reservas de Roomia PMS.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setInvalidUrlError(false);
                  setOpenHotelId(null);
                  setShowLandingPage(false);
                  setClientTab('explore');
                  window.history.pushState(null, '', '/');
                }}
                className="w-full bg-[#23B4E6] hover:bg-[#3fc2f0] active:scale-[0.98] text-slate-950 font-extrabold py-3 rounded-xl text-xs transition-all shadow-lg shadow-brand-cyan/20 cursor-pointer"
              >
                Aceptar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
