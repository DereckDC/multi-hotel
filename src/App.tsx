/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent, useRef, lazy, Suspense } from 'react';
import { useHotelStore, compressImage } from './store';
import { supabase } from './supabase';
import ClientView from './components/ClientView';
import LoginView from './components/LoginView';
import LandingPageView from './components/LandingPageView';
import { StepPanel, StepIndicator, StepActions, useFormStepper } from './components/FormStepper';
import type { LegalDocType } from './components/LegalPageView';
import type { AdminTab } from './types';
import { useBackHandler } from './utils/backButton';
import { PAGES, hotelMeta } from '../api/seo';
import { setPageMeta } from './utils/pageMeta';
import { notify } from './utils/notify';
import { BackButton, Button, HEADER_ACTIONS_ID, MenuItem, MenuToggle, Modal, ToastHost } from './components/ui';

const ReceptionView = lazy(() => import('./components/ReceptionView'));
const SupportChatDrawer = lazy(() => import('./components/SupportChatDrawer'));
const AdminView = lazy(() => import('./components/AdminView'));
const LegalPageView = lazy(() => import('./components/LegalPageView'));
import { InteractiveContainer } from './components/InteractiveContainer';
import { BrandLogo } from './components/BrandLogo';
import { LoadingSkeletonView } from './components/LoadingSkeletonView';
import { LayoutDashboard, Users, User as UserIcon, CalendarDays, KeyRound, Star, Building2, ShieldAlert, LogOut, Edit3, Camera, Check, X, Shield, AlertCircle, Eye, EyeOff, Briefcase, LogIn, Key, Menu, Home, Compass, DollarSign, ClipboardList, QrCode, Calendar, ArrowLeft, Loader2, CreditCard, Wallet, ReceiptText } from 'lucide-react';
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

const STEPS_PROFILE = [{ label: 'Foto' }, { label: 'Datos personales' }, { label: 'Seguridad' }];

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
    icalFeeds = [],
    externalBlocks = [],
    refreshIcal,
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
      notify.success('Conexión restablecida.');
    };
    const handleOffline = () => {
      setIsOffline(true);
      notify.warning('Perdiste la conexión a internet.');
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
    // Una cuenta de Supabase Auth (id con formato UUID) sin sesión válida ya no puede
    // leer ni guardar datos: en vez de dejarla "conectada" con la pantalla vacía, se
    // cierra la sesión y se pide volver a entrar. No actúa sin conexión ni ante fallos
    // de red, para no expulsar a nadie por un corte momentáneo.
    const closeSessionIfExpired = async (savedId: string) => {
      const isAuthAccount = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(savedId);
      if (!isAuthAccount) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (data?.session) return;
        const status = (error as any)?.status;
        if (error && (error.name === 'AuthRetryableFetchError' || status === 0 || (typeof status === 'number' && status >= 500))) {
          return;
        }
      } catch {
        return;
      }
      localStorage.removeItem('aura_hotel_pms_current_user_id');
      switchSessionUserRef.current('');
      setIsLoggedOut(true);
      notify.warning('Tu sesión expiró. Inicia sesión nuevamente para continuar.');
    };

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
              if (event === 'INITIAL_SESSION' && typeof parsed === 'string') {
                // Fuera del callback: Supabase desaconseja llamar a su API dentro de él
                setTimeout(() => { closeSessionIfExpired(parsed); }, 0);
              }
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
  // "Atrás" de Android cierra el menú abierto
  useBackHandler(sidebarOpen, () => setSidebarOpen(false));
  const [clientTab, setClientTab] = useState<'explore' | 'properties' | 'reservations'>(() => {
    if (typeof window === 'undefined') return 'explore';
    const path = window.location.pathname;
    // Vuelta desde la página de pago (/pago/respuesta): abrir directamente "Mis reservas"
    const params = new URLSearchParams(window.location.search);
    if (params.get('seccion') === 'mis-reservas') {
      params.delete('seccion');
      const rest = params.toString();
      window.history.replaceState(null, '', `${path}${rest ? `?${rest}` : ''}${window.location.hash}`);
      return 'reservations';
    }
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
  const [adminActiveTab, setAdminActiveTab] = useState<AdminTab>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const params = new URLSearchParams(window.location.search);
    if (params.get('seccion') !== 'mi-plan') return 'dashboard';
    params.delete('seccion');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    return 'plan';
  });
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

    // Al entrar o salir de la landing se empieza arriba (antes se abría a media página)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [showLandingPage]);

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

  // Título, descripción y URL canónica según la página (Google ejecuta JavaScript al indexar)
  useEffect(() => {
    if (activeLegalDoc) {
      setPageMeta(PAGES[activeLegalDoc]);
      return;
    }
    if (showLandingPage) {
      setPageMeta(PAGES.landing);
      return;
    }
    const hotel = openHotelId ? hotels.find(h => h.id === openHotelId) : undefined;
    if (hotel) {
      setPageMeta(hotelMeta(
        { ...hotel, tipo: hotel.tipoEstablecimiento, finalidad: hotel.finalidad, precio: hotel.detallesInmueble?.precio },
        rooms.filter(r => r.hotelId === hotel.id)
      ));
      return;
    }
    setPageMeta(PAGES.home);
  }, [activeLegalDoc, showLandingPage, openHotelId, hotels, rooms]);

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

  // Profile Edit Modal States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const profileStepper = useFormStepper(3);
  useEffect(() => { if (showProfileModal) profileStepper.reset(); }, [showProfileModal]);
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
    await updateUserProfile(activeUser.id, {
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

  // Registra en la bitácora (estado local + tabla logs de Supabase)
  const handleAddLogSimulated = (action: string, details: string) => {
    const logStr = `${activeUser.nombre} ${activeUser.apellido}`.trim();
    store.addLog(logStr, activeUser.rol, action, details);
  };

  if (activeLegalDoc !== null) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#F8FAFB] flex items-center justify-center p-8"><Loader2 className="w-8 h-8 text-brand-cyan animate-spin" /></div>}>
        <LegalPageView
          documentType={activeLegalDoc}
          onClose={() => {
            // If we had an active user session, go back to app, else go back to landing
            window.history.pushState(null, '', '/');
            setActiveLegalDoc(null);
          }}
          onSelectDoc={(type) => setActiveLegalDoc(type)}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col selection:bg-brand-cyan selection:text-brand-navy2">
      
      {/* 2. Global application Header */}
      {!showLandingPage && (
        <header className="bg-neutral-950 print:hidden w-full sticky top-0 z-40 pt-safe">
          <div className={`w-full px-4 sm:px-6 h-20 flex items-center justify-between transition-all duration-300 ${
            isSidebarActive 
              ? (sidebarOpen || sidebarHovered ? 'md:pl-[17rem]' : 'md:pl-[5rem]') 
              : ''
          }`}>
            
            <div className="flex items-center gap-1 navbar-logo-container">
              {!showFullLoginScreen && (
                <MenuToggle open={sidebarOpen} onClick={() => setSidebarOpen(prev => !prev)} className="-ml-2 md:hidden" />
              )}
              <BrandLogo size="lg" showText={true} lightText={true} />
            </div>

            <div className="flex items-center gap-3">
              {isInitialSyncing && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan rounded-full text-xs font-semibold shadow-sm animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-cyan" />
                  <span className="hidden sm:inline">Actualizando catálogo...</span>
                  <span className="sm:hidden">Actualizando...</span>
                </div>
              )}

              {showFullLoginScreen && (
                <BackButton
                  onClick={() => {
                    setShowFullLoginScreen(false);
                    setClientTab('explore');
                    setOpenHotelId(null);
                  }}
                />
              )}
              {/* Aquí se coloca el botón Volver de la pantalla abierta (ficha de hotel, habitación…) */}
              <div id={HEADER_ACTIONS_ID} className="flex items-center" />
            </div>

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
                  colorClass: "text-danger-400 hover:text-danger-300 hover:bg-danger-950/20"
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
                colorClass: "text-warning-400 hover:text-warning-300 hover:bg-warning-950/20"
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
                colorClass: "text-danger-400 hover:text-danger-300 hover:bg-danger-950/20"
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
              ...(activeUser?.rol === 'super_admin' || activeUser?.rol === 'hotel_admin'
                ? [{
                    icon: ReceiptText,
                    label: "Facturación SRI",
                    active: adminActiveTab === 'billing',
                    onClick: () => { setAdminActiveTab('billing'); setSidebarOpen(false); }
                  }]
                : []),
              ...(activeUser?.rol === 'super_admin'
                ? [{
                    icon: Wallet,
                    label: "Suscripciones",
                    active: adminActiveTab === 'subscriptions',
                    onClick: () => { setAdminActiveTab('subscriptions'); setSidebarOpen(false); }
                  }]
                : [{
                    icon: CreditCard,
                    label: "Mi plan",
                    active: adminActiveTab === 'plan',
                    onClick: () => { setAdminActiveTab('plan'); setSidebarOpen(false); }
                  }]),
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
                colorClass: "text-danger-400 hover:text-danger-300 hover:bg-danger-950/20"
              }
            );
          }

          const renderMenuItems = (isExpanded: boolean) => {
            return menuItems.map((item, index) => (
              <MenuItem
                key={index}
                id={`sidebar-item-${index}`}
                icon={item.icon}
                label={item.label}
                active={item.active}
                colorClass={item.colorClass}
                expanded={isExpanded}
                onClick={item.onClick}
              />
            ));
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

              {/* Menú del teléfono. Se monta y desmonta sin animación de salida: con AnimatePresence el panel
                  quedaba montado (alto 0) después de cerrarse */}
                {sidebarOpen && (
                  <div
                    className="fixed md:hidden left-0 right-0 w-full bg-neutral-950 z-40 shadow-xl overflow-hidden flex flex-col animate-fade-in"
                    style={{ top: 'calc(5rem + var(--safe-top))' }}
                    id="mobile-dropdown-menu"
                  >
                    <div className="py-4 px-4 space-y-1.5 max-h-[70vh] overflow-y-auto overflow-x-hidden">
                      {renderMenuItems(true)}
                    </div>
                    {/* Mobile User Profile indicator at the bottom of dropdown */}
                    <div className="p-4 bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-cyan/10 flex items-center justify-center text-brand-cyan shrink-0">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {isLoggedOut || !activeUser ? 'Invitado' : `${activeUser.nombre}`}
                          </p>
                          {!(isLoggedOut || !activeUser) && (
                            <p className="text-micro text-brand-cyan truncate mt-0.5 uppercase tracking-wider">
                              {activeUser.rol.replace('_', ' ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}



              {/* Desktop Sidebar (Always overlaying on the left, full height top to bottom) */}
              <aside
                onMouseEnter={() => setSidebarHovered(true)}
                onMouseLeave={() => setSidebarHovered(false)}
                className={`bg-neutral-950 flex flex-col justify-between transition-all duration-300 shrink-0 z-50 h-screen ${
                  sidebarOpen || sidebarHovered
                    ? 'w-64'
                    : 'w-16'
                } fixed top-0 bottom-0 left-0 overflow-hidden print:hidden hidden md:flex pt-safe`}
                id="sidebar-navigation-desktop"
              >
                {/* Botón de menú, a la altura del encabezado */}
                <div className={`h-20 flex items-center shrink-0 transition-all duration-300 ${
                  sidebarOpen || sidebarHovered ? 'px-3' : 'justify-center'
                }`}>
                  <MenuToggle
                    open={sidebarOpen}
                    onClick={() => setSidebarOpen(prev => !prev)}
                    showLabel={sidebarOpen || sidebarHovered}
                  />
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-1">
                  {renderMenuItems(sidebarOpen || sidebarHovered)}
                </div>
                <div className="p-4 bg-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-cyan/10 flex items-center justify-center text-brand-cyan shrink-0">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    {(sidebarOpen || sidebarHovered) && (
                      <div className="min-w-0 transition-opacity duration-300">
                        <p className="text-xs font-bold text-white truncate leading-tight">
                          {isLoggedOut || !activeUser ? 'Invitado' : `${activeUser.nombre}`}
                        </p>
                        {!(isLoggedOut || !activeUser) && (
                          <p className="text-micro text-brand-cyan truncate mt-0.5 uppercase tracking-wider">
                            {activeUser.rol.replace('_', ' ')}
                          </p>
                        )}
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
                          isLoading={isInitialSyncing}
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
                              isLoading={isInitialSyncing}
                            />
                          )}

                          {(activeUser?.rol === 'recepcionista' || ((activeUser?.rol === 'hotel_admin' || activeUser?.rol === 'super_admin') && viewOverride === 'reception')) && (
                            <Suspense fallback={<div className="p-12 flex justify-center items-center"><Loader2 className="w-8 h-8 text-brand-cyan animate-spin" /></div>}>
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
                                externalBlocks={externalBlocks}
                              />
                            </Suspense>
                          )}

                          {((activeUser?.rol === 'hotel_admin' || activeUser?.rol === 'super_admin') && viewOverride !== 'reception') && (
                            <Suspense fallback={<div className="p-12 flex justify-center items-center"><Loader2 className="w-8 h-8 text-brand-cyan animate-spin" /></div>}>
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
                                icalFeeds={icalFeeds}
                                externalBlocks={externalBlocks}
                                onRefreshIcal={refreshIcal}
                                onAddLog={handleAddLogSimulated}
                              />
                            </Suspense>
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
        <Modal
          open
          onClose={() => setShowAuthModal(false)}
          size="lg"
          title="Identifícate para continuar"
          subtitle="Inicia sesión o regístrate para continuar con tu reserva y recibir tu comprobante."
          bodyClassName="p-4 md:p-6"
        >
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
        </Modal>
      )}

      {/* 4. Tiny visual footer */}
      <footer className={`py-12 text-center text-micro font-mono print:hidden space-y-4 bg-neutral-950 text-[#A8B2BD] transition-all duration-300 ${
        isSidebarActive 
          ? (sidebarOpen || sidebarHovered ? 'md:pl-64' : 'md:pl-16') 
          : ''
      }`}>
        <p className="text-white/80 font-semibold select-none">© 2026 Roomia PMS · Maqyasoft</p>
        <p className="text-white/40 text-micro">Hora Ecuador (GMT-5): {ecuadorTime || 'Cargando...'}</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-medium pt-2">
          <button
            type="button"
            onClick={() => {
              window.history.pushState(null, '', '/terminos-y-condiciones');
              setActiveLegalDoc('terminos');
            }}
            className="hover:text-brand-cyan transition-colors cursor-pointer text-neutral-300"
            id="footer-link-terminos"
          >
            Términos y Condiciones
          </button>
          <span className="text-neutral-700 select-none">•</span>
          <button
            type="button"
            onClick={() => {
              window.history.pushState(null, '', '/politica-de-privacidad');
              setActiveLegalDoc('privacidad');
            }}
            className="hover:text-brand-cyan transition-colors cursor-pointer text-neutral-300"
            id="footer-link-privacidad"
          >
            Política de Privacidad
          </button>
          <span className="text-neutral-700 select-none">•</span>
          <button
            type="button"
            onClick={() => {
              window.history.pushState(null, '', '/politica-de-cancelaciones-y-reembolsos');
              setActiveLegalDoc('cancelaciones');
            }}
            className="hover:text-brand-cyan transition-colors cursor-pointer text-neutral-300"
            id="footer-link-cancelaciones"
          >
            Política de Cancelación y Reembolsos
          </button>
        </div>
      </footer>

      {/* Global Edit Profile Modal */}
      {showProfileModal && (
        <Modal
          open
          onClose={() => setShowProfileModal(false)}
          layer="critical"
          size="lg"
          title="Actualizar datos de perfil"
          subtitle={`Rol actual: ${activeUser?.rol ? activeUser.rol.replace('_', ' ') : 'Cliente'}`}
          bodyClassName="p-0"
        >
        <StepIndicator steps={STEPS_PROFILE} current={profileStepper.step} onGo={profileStepper.goTo} />
        <form ref={profileStepper.formRef} onSubmit={profileStepper.wrapSubmit(handleProfileSubmit)} className="p-6 space-y-5">
          
          <StepPanel step={1} current={profileStepper.step}>
          {/* Presets Avatars Picker */}
          <div className="space-y-2.5">
            <label className="text-micro font-bold text-neutral-400 uppercase tracking-wide block">Foto / Avatar de Perfil:</label>
            
            <div className="flex items-center gap-4 bg-neutral-50 p-3 rounded-2xl border border-neutral-200">
              <img 
                src={profileAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                alt="Currently selected avatar" 
                className="w-16 h-16 rounded-full object-cover border-2 border-teal-500 shadow-sm shrink-0" 
              />
              <div className="flex-1">
                <span className="text-micro text-neutral-400 font-medium block">¿Quieres usar una imagen predeterminada? Elige una:</span>
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
                          <div className="absolute inset-0 bg-teal-600/30 flex items-center justify-center">
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
              <span className="text-micro text-neutral-400 font-medium block mb-1">O suba una imagen de su dispositivo:</span>
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
                          notify.warning('La imagen es demasiado grande. Prueba con una más liviana.');
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
                <span className="text-micro text-neutral-400 font-medium block mb-1">O pega el enlace de una imagen:</span>
                <input
                  type="url"
                  value={profileAvatar}
                  onChange={(e) => setProfileAvatar(e.target.value)}
                  placeholder="https://ejemplo.com/mi-foto.jpg"
                  className="w-full text-xs font-mono border border-neutral-200 p-2.5 rounded-xl bg-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 shadow-sm"
                />
              </div>
            </div>
          </div>
          </StepPanel>

          {/* Text Fields Grid */}
          <div className="grid grid-cols-2 gap-4">
            <StepPanel step={2} current={profileStepper.step}>
            <div>
              <label className="text-micro font-bold text-neutral-400 uppercase tracking-wide block mb-1">Nombre / Primer Nombre:</label>
              <input
                type="text" required
                value={profileNombre}
                onChange={(e) => setProfileNombre(e.target.value)}
                placeholder="Ej: Sofía"
                className="w-full text-xs border border-neutral-200 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
              />
            </div>

            <div>
              <label className="text-micro font-bold text-neutral-400 uppercase tracking-wide block mb-1">Apellido / Surname:</label>
              <input
                type="text" required
                value={profileApellido}
                onChange={(e) => setProfileApellido(e.target.value)}
                placeholder="Ej: Rodríguez"
                className="w-full text-xs border border-neutral-200 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
              />
            </div>

            <div className="col-span-2">
              <label className="text-micro font-bold text-neutral-400 uppercase tracking-wide block mb-1">Correo Electrónico:</label>
              <input
                type="email" required
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                placeholder="contacto@roomiasaas.com"
                className="w-full text-xs border border-neutral-200 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 font-mono"
              />
            </div>

            <div>
              <label className="text-micro font-bold text-neutral-400 uppercase tracking-wide block mb-1">Teléfono Móvil / Fijo:</label>
              <input
                type="tel" required
                value={profileTelefono}
                onChange={(e) => setProfileTelefono(e.target.value)}
                placeholder="+34 612 345 678"
                className="w-full text-xs border border-neutral-200 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
              />
            </div>

            <div>
              <label className="text-micro font-bold text-neutral-400 uppercase tracking-wide block mb-1">Documento (DNI/NIE/Pasaporte):</label>
              <input
                type="text" required
                value={profileDocumento}
                onChange={(e) => setProfileDocumento(e.target.value)}
                placeholder="Ej: 12345678A"
                className="w-full text-xs border border-neutral-200 p-2.5 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 font-mono"
              />
            </div>
            </StepPanel>

            <StepPanel step={3} current={profileStepper.step}>
            <div className="col-span-2 border-t border-neutral-100 pt-3 mt-1">
              <label className="text-micro font-bold text-warning-700 uppercase tracking-wide block mb-1">Cambiar contraseña:</label>
              <div className="relative">
                <input
                  type={showProfilePass ? "text" : "password"}
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  placeholder="Deje en blanco para conservar su clave de acceso habitual"
                  className="w-full text-xs border border-neutral-200 p-2.5 pr-10 rounded-xl focus:outline-none focus:border-warning-500 focus:ring-1 focus:ring-warning-200 bg-warning-50/10 placeholder-neutral-400 font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowProfilePass(!showProfilePass)}
                  className="absolute right-3 top-3 p-0.5 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                >
                  {showProfilePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-micro text-neutral-400 mt-1">Al ingresar una nueva clave, se modificará su acceso y recibirá una notificación de seguridad por correo.</p>
            </div>
            </StepPanel>
          </div>

          {/* Action Buttons */}
          <StepActions step={profileStepper.step} total={3} onCancel={() => setShowProfileModal(false)} onBack={profileStepper.back} onNext={profileStepper.next} submitLabel="Guardar Cambios" />

        </form>
        </Modal>
      )}

      {/* FORCED PASSWORD CHANGE SCREEN (ONLY FOR FIRST LOGIN OR RESET BY ADMIN) */}
      {activeUser && activeUser.debeCambiarPassword && !isLoggedOut && (
        <div className="fixed inset-0 bg-brand-navy2/95 flex items-center justify-center p-4 z-critical backdrop-blur-md animate-fade-in ">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full border border-neutral-100 flex flex-col p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-warning-50 rounded-2xl flex items-center justify-center mx-auto border border-warning-200 shadow-sm">
                <Shield className="w-6 h-6 text-warning-600 animate-bounce" />
              </div>
              <h3 className="text-base font-bold text-neutral-800">Cambio de Contraseña Obligatorio</h3>
              <p className="text-micro text-neutral-500 leading-relaxed">
                Por seguridad y resguardo, es obligatorio actualizar la clave temporal ingresando una nueva clave personalizada antes de usar Roomia PMS.
              </p>
            </div>

            {forcedPassSuccess && (
              <div className="bg-success-50 border border-success-200 text-success-800 p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
                <Check className="w-4.5 h-4.5 text-success-600 shrink-0" />
                <span>{forcedPassSuccess}</span>
              </div>
            )}

            {forcedPassError && (
              <div className="bg-danger-50 border border-danger-200 text-danger-800 p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
                <AlertCircle className="w-4.5 h-4.5 text-danger-600 shrink-0" />
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
                <label className="text-micro font-bold text-neutral-400 uppercase tracking-wide block">Nueva Contraseña de Acceso:</label>
                <div className="relative">
                  <input
                    type={showForcedPass ? "text" : "password"}
                    required
                    value={forcedPassInput}
                    onChange={(e) => setForcedPassInput(e.target.value)}
                    placeholder="Escribe tu nueva contraseña"
                    className="w-full text-xs border border-neutral-200 p-2.5 pr-10 rounded-xl focus:outline-none focus:border-teal-500 font-mono text-center tracking-widest bg-neutral-50 font-bold"
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
                <label className="text-micro font-bold text-neutral-400 uppercase tracking-wide block">Confirmar Contraseña:</label>
                <div className="relative">
                  <input
                    type={showForcedConfirmPass ? "text" : "password"}
                    required
                    value={forcedConfirmPassInput}
                    onChange={(e) => setForcedConfirmPassInput(e.target.value)}
                    placeholder="Repite tu contraseña"
                    className="w-full text-xs border border-neutral-200 p-2.5 pr-10 rounded-xl focus:outline-none focus:border-teal-500 font-mono text-center tracking-widest bg-neutral-50 font-bold"
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

              <Button
                type="submit"
                disabled={forcedPassLoading || !forcedPassInput.trim() || forcedPassInput !== forcedConfirmPassInput}
                variant="primary" size="md" className="w-full"
              >
                {forcedPassLoading ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Establecer Nueva Contraseña</span>
                  </>
                )}
              </Button>
              
              {forcedPassInput && forcedConfirmPassInput && forcedPassInput !== forcedConfirmPassInput && (
                <p className="text-micro text-danger-500 text-center font-semibold">Las contraseñas no coinciden.</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Real-time Global Support Chat Component Drawer - Only visible once user has logged in */}
      {activeUser && !isLoggedOut && (
        <Suspense fallback={null}>
          <SupportChatDrawer
            hotels={hotels}
            activeUser={activeUser}
            messages={messages}
            onSendMessage={sendChatMessage}
            onMarkAsRead={markMessagesAsRead}
            openHotelId={openHotelId}
            users={users}
          />
        </Suspense>
      )}

      <ToastHost />

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
                className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-xl bg-warning-950/95 border-2 border-warning-600/80 backdrop-blur-md text-warning-100 p-4 rounded-2xl shadow-xl flex items-center gap-3 justify-between shadow-warning-950/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-warning-500/20 text-warning-400 flex items-center justify-center shrink-0 animate-pulse">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-xs text-white">Modo sin conexión activo</h5>
                    <p className="text-micro text-warning-300 leading-tight">La app funciona con datos locales. Los registros y reservas se completarán cuando vuelva el internet.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOffline(!navigator.onLine)}
                  className="px-3 py-1 bg-warning-500 hover:bg-warning-400 active:scale-95 text-neutral-950 text-micro font-black rounded-lg transition-all cursor-pointer shrink-0"
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
                className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-critical flex items-center justify-center p-4 "
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl max-w-md w-full shadow-xl space-y-6 text-center"
                >
                  <div className="mx-auto w-16 h-16 bg-danger-500/10 border border-danger-500/20 rounded-2xl flex items-center justify-center text-danger-500 animate-pulse">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white">Sin Conexión a Internet</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      Para evitar reservas duplicadas o conflictos en recepción, el panel se pausó hasta que vuelva la conexión.
                    </p>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl text-left space-y-2">
                    <h4 className="text-micro font-black text-neutral-500 uppercase tracking-widest">Sugerencias operativas:</h4>
                    <ul className="text-micro text-neutral-400 space-y-1.5 font-semibold">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
                        <span>Revisa que el Wi-Fi o los datos móviles estén encendidos</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
                        <span>Desactiva y vuelve a activar el modo avión de tu celular o tablet</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
                        <span>La plataforma se restablecerá sola en cuanto detecte señal</span>
                      </li>
                    </ul>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      const online = navigator.onLine;
                      setIsOffline(!online);
                      if (online) {
                        notify.success('Conexión restablecida.');
                      } else {
                        notify.warning('Todavía no hay internet. Inténtalo de nuevo.');
                      }
                    }}
                    variant="accent" size="md" className="w-full"
                  >
                    Reintentar conexión
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      {/* 🚫 INVALID HOTEL/PROPERTY SLUG MODAL OVERLAY */}
      <AnimatePresence>
        {invalidUrlError && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-critical flex items-center justify-center p-4 ">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-brand-navy1 border-2 border-brand-cyan/20 p-8 rounded-2xl max-w-md w-full shadow-xl text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 bg-danger-500/10 border border-danger-500/20 rounded-2xl flex items-center justify-center text-danger-500">
                <ShieldAlert className="w-8 h-8 text-brand-cyan" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-white">Establecimiento No Encontrado</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  El hotel o propiedad que estás intentando buscar no existe en nuestro sistema de reservas de Roomia PMS.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => {
                  setInvalidUrlError(false);
                  setOpenHotelId(null);
                  setShowLandingPage(false);
                  setClientTab('explore');
                  window.history.pushState(null, '', '/');
                }}
                variant="accent" size="md" className="w-full"
              >
                Aceptar
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}