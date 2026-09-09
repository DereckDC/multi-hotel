/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  X, 
  User, 
  Users,
  Lock,
  ShieldCheck, 
  CheckCheck, 
  Building2, 
  MessageCircle,
  ChevronDown
} from 'lucide-react';
import { Hotel, User as UserType, ChatMessage, UserRole } from '../types';
import { sortMessagesChronologically } from '../utils/chatUtils';

interface SupportChatDrawerProps {
  hotels: Hotel[];
  activeUser: UserType;
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
  onMarkAsRead: (hotelId: string, senderId: string, role: UserRole, options?: { targetCustomerId?: string; isClientReading?: boolean }) => void;
  openHotelId?: string | null;
  users?: UserType[];
}

export default function SupportChatDrawer({
  hotels,
  activeUser,
  messages,
  onSendMessage,
  onMarkAsRead,
  openHotelId,
  users = []
}: SupportChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [chatChannel, setChatChannel] = useState<'guests' | 'internal'>('guests');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef<boolean>(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const prevMessageCountRef = useRef<number>(0);
  const prevConversationKeyRef = useRef<string>('');
  const isSettlingScrollRef = useRef<boolean>(false);

  const isStaff = activeUser?.rol ? activeUser.rol !== 'cliente' : false;

  // Get active and available hotels - restringe si es staff de hotel (no super admin)
  const activeHotels = React.useMemo(() => {
    return hotels.filter(h => {
      if (h.estado !== 'activo') return false;
      if (isStaff && activeUser?.rol !== 'super_admin') {
        return h.id === activeUser?.hotelId || activeUser?.hotelIds?.includes(h.id);
      }
      return true;
    });
  }, [hotels, isStaff, activeUser?.hotelId, activeUser?.hotelIds, activeUser?.rol]);

  // If client, default and keep selectedHotelId in sync with the openHotelId
  useEffect(() => {
    if (!isStaff && openHotelId) {
      setSelectedHotelId(openHotelId);
    } else if (!isStaff && !selectedHotelId && activeHotels.length > 0) {
      setSelectedHotelId(activeHotels[0].id);
    }
  }, [isStaff, openHotelId, activeHotels, selectedHotelId]);

  // Set default selected hotel for staff
  useEffect(() => {
    if (isStaff && !selectedHotelId) {
      if (activeUser.hotelId) {
        setSelectedHotelId(activeUser.hotelId);
      } else if (activeHotels.length > 0) {
        setSelectedHotelId(activeHotels[0].id);
      }
    }
  }, [isStaff, activeUser, activeHotels, selectedHotelId]);

  // Filter messages based on role and selected targets, strictly isolated per customer
  const filteredMessages = React.useMemo(() => {
    const hotelFilterId = isStaff && activeUser?.rol !== 'super_admin' ? (activeUser?.hotelId || selectedHotelId) : selectedHotelId;
    let raw: ChatMessage[] = [];

    if (!isStaff) {
      // CLIENTE: Ve ÚNICA Y EXCLUSIVAMENTE su propia conversación con el hotel seleccionado
      // NUNCA ve mensajes de otros clientes ni respuestas del staff dirigidas a otros clientes
      raw = messages.filter(m => {
        if (m.hotelId !== hotelFilterId) return false;
        if (m.channel === 'internal') return false;

        // 1. Mensajes enviados por este mismo cliente
        if (m.senderId === activeUser?.id) return true;

        // 2. Mensajes enviados por administradores o recepcionistas dirigidos a este cliente
        if (m.senderRole !== 'cliente') {
          return m.recipientId === activeUser?.id || m.customerId === activeUser?.id;
        }

        return false;
      });
    } else {
      if (chatChannel === 'internal') {
        // Internal team channel: only messages between admin and receptionists for this hotel
        raw = messages.filter(m => 
          m.hotelId === hotelFilterId && 
          m.channel === 'internal' && 
          m.senderRole !== 'cliente'
        );
      } else {
        // Staff view of guest conversations: exclusivamente los mensajes del cliente seleccionado
        if (!selectedCustomerId) return [];
        raw = messages.filter(m => {
          if (m.hotelId !== hotelFilterId) return false;
          if (m.channel === 'internal') return false;

          // Mensaje enviado por el cliente seleccionado
          if (m.senderId === selectedCustomerId && m.senderRole === 'cliente') return true;

          // Mensaje enviado por el staff dirigido a este cliente seleccionado
          if (m.senderRole !== 'cliente') {
            return m.recipientId === selectedCustomerId || m.customerId === selectedCustomerId;
          }

          return false;
        });
      }
    }
    return sortMessagesChronologically(raw);
  }, [messages, isStaff, activeUser?.rol, activeUser?.id, activeUser?.hotelId, selectedHotelId, selectedCustomerId, chatChannel]);

  // Get unique clients with their conversation status and unread count (for staff selection)
  const hotelClients = React.useMemo(() => {
    const hotelFilterId = isStaff && activeUser.rol !== 'super_admin' ? (activeUser.hotelId || selectedHotelId) : selectedHotelId;
    if (!hotelFilterId) return [];
    
    const clientMap = new Map<string, { id: string; name: string; unreadCount: number }>();

    // 1. Clientes registrados en el sistema
    if (users && users.length > 0) {
      users
        .filter(u => u.rol === 'cliente')
        .forEach(u => {
          const fullName = `${u.nombre} ${u.apellido}`.trim() || u.email;
          clientMap.set(u.id, { id: u.id, name: fullName, unreadCount: 0 });
        });
    }

    // 2. Clientes que han interactuado en el chat del hotel (incluso invitados o anónimos)
    messages
      .filter(m => m.hotelId === hotelFilterId && m.channel !== 'internal')
      .forEach(m => {
        const cId = m.senderRole === 'cliente' ? m.senderId : (m.recipientId || m.customerId);
        if (cId) {
          const existing = clientMap.get(cId);
          if (existing) {
            if (m.senderRole === 'cliente' && m.senderName && existing.name.startsWith('Huésped')) {
              existing.name = m.senderName;
            }
          } else {
            const clientName = m.senderRole === 'cliente' ? m.senderName : `Huésped (${cId.substring(0, 8)})`;
            clientMap.set(cId, { id: cId, name: clientName, unreadCount: 0 });
          }
        }
      });

    // 3. Contar mensajes no leídos enviados por cada cliente a este hotel
    messages
      .filter(m => m.hotelId === hotelFilterId && m.channel !== 'internal' && m.senderRole === 'cliente' && !m.read)
      .forEach(m => {
        const entry = clientMap.get(m.senderId);
        if (entry) {
          entry.unreadCount += 1;
        }
      });

    return Array.from(clientMap.values());
  }, [messages, selectedHotelId, isStaff, activeUser.hotelId, activeUser.rol, users]);

  // Get staff team members linked to this hotel
  const hotelStaffMembers = React.useMemo(() => {
    const hotelFilterId = isStaff && activeUser?.rol !== 'super_admin' ? (activeUser?.hotelId || selectedHotelId) : selectedHotelId;
    if (!users || !hotelFilterId) return [];
    return users.filter(u => {
      if (u.rol === 'cliente') return false;
      if (u.rol === 'super_admin') return true;
      return u.hotelId === hotelFilterId || u.hotelIds?.includes(hotelFilterId);
    });
  }, [users, isStaff, activeUser?.hotelId, activeUser?.rol, selectedHotelId]);

  // If staff and in guests tab and no customer selected, default to client with unread messages or the first client
  useEffect(() => {
    if (isStaff && chatChannel === 'guests' && !selectedCustomerId && hotelClients.length > 0) {
      const clientWithUnread = hotelClients.find(c => c.unreadCount > 0);
      setSelectedCustomerId(clientWithUnread ? clientWithUnread.id : hotelClients[0].id);
    }
  }, [isStaff, chatChannel, hotelClients, selectedCustomerId]);

  // User scroll listener: detects if the user intentionally scrolled up to read earlier messages
  const handleScroll = () => {
    if (isSettlingScrollRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distanceFromBottom <= 80;
    isAtBottomRef.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);
  };

  // Safe scroll to bottom of chat
  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const container = scrollContainerRef.current;
    if (container) {
      if (behavior === 'auto') {
        container.scrollTop = container.scrollHeight;
      } else {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
      } catch {
        // Safe fallback for browsers
      }
    }
  };

  // Force scroll to bottom across multiple render and animation frames
  const forceScrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    isAtBottomRef.current = true;
    setShowScrollBottom(false);
    isSettlingScrollRef.current = true;

    // 1. Inmediato
    scrollToBottom(behavior);

    // 2. Siguiente frame de animación
    const rafId = requestAnimationFrame(() => {
      scrollToBottom(behavior);
    });

    // 3. Tras renderizado de layout y estilos
    const t1 = setTimeout(() => {
      scrollToBottom(behavior);
    }, 50);

    const t2 = setTimeout(() => {
      scrollToBottom(behavior);
    }, 150);

    const t3 = setTimeout(() => {
      scrollToBottom(behavior);
      isSettlingScrollRef.current = false;
    }, 320);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  };

  // On drawer open, ensure default position is at the very bottom
  useEffect(() => {
    if (isOpen) {
      return forceScrollToBottom('auto');
    }
  }, [isOpen]);

  // Smart scroll effect on conversation change, tab switch, or new message arrival
  useEffect(() => {
    if (!isOpen) return;

    const conversationKey = `${selectedHotelId}_${chatChannel}_${chatChannel === 'guests' ? selectedCustomerId : 'internal'}`;
    const isNewConversation = prevConversationKeyRef.current !== conversationKey;
    const currentCount = filteredMessages.length;
    const hasMoreMessages = currentCount > prevMessageCountRef.current;

    if (isNewConversation) {
      // Reset position when switching conversation or tab to always start at bottom
      prevConversationKeyRef.current = conversationKey;
      prevMessageCountRef.current = currentCount;
      return forceScrollToBottom('auto');
    }

    if (hasMoreMessages) {
      prevMessageCountRef.current = currentCount;
      if (isAtBottomRef.current) {
        return forceScrollToBottom('smooth');
      }
    } else {
      prevMessageCountRef.current = currentCount;
    }
  }, [isOpen, filteredMessages.length, selectedHotelId, selectedCustomerId, chatChannel]);

  // Mark incoming messages as read when drawer is open and visible
  useEffect(() => {
    if (!isOpen || !selectedHotelId) return;

    if (!isStaff) {
      // Client marks messages from hotel staff directed to this client as read
      const unreadStaffMessages = messages.filter(m => 
        m.hotelId === selectedHotelId && 
        m.senderRole !== 'cliente' && 
        m.channel !== 'internal' && 
        (m.recipientId === activeUser?.id || m.customerId === activeUser?.id) &&
        !m.read
      );
      if (unreadStaffMessages.length > 0) {
        onMarkAsRead(selectedHotelId, activeUser?.id, 'cliente', { isClientReading: true });
      }
    } else {
      if (chatChannel === 'guests') {
        // Staff marks messages from this specific client as read
        if (selectedCustomerId) {
          const unreadClientMessages = messages.filter(m => 
            m.hotelId === selectedHotelId && 
            m.senderId === selectedCustomerId && 
            m.senderRole === 'cliente' && 
            m.channel !== 'internal' && 
            !m.read
          );
          if (unreadClientMessages.length > 0) {
            onMarkAsRead(selectedHotelId, activeUser?.id, activeUser?.rol, { targetCustomerId: selectedCustomerId });
          }
        }
      } else {
        // Staff marks unread internal messages from other colleagues as read
        const unreadInternal = messages.filter(m => 
          m.hotelId === selectedHotelId && 
          m.channel === 'internal' && 
          m.senderRole !== 'cliente' && 
          m.senderId !== activeUser.id && 
          !m.read
        );
        unreadInternal.forEach(m => {
          onMarkAsRead(selectedHotelId, m.senderId, m.senderRole);
        });
      }
    }
  }, [isOpen, messages, selectedHotelId, selectedCustomerId, isStaff, chatChannel, onMarkAsRead, activeUser?.id, activeUser?.rol]);

  // Format timestamp for display
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Calculate unread counts for guests and internal channel
  const unreadGuestCount = React.useMemo(() => {
    if (!isStaff) {
      // Huésped: cuenta únicamente las respuestas no leídas del hotel dirigidas a él
      return messages.filter(m => 
        m.channel !== 'internal' && 
        m.senderRole !== 'cliente' && 
        m.hotelId === selectedHotelId && 
        (m.recipientId === activeUser?.id || m.customerId === activeUser?.id) &&
        !m.read
      ).length;
    }
    const hotelFilterId = activeUser?.rol !== 'super_admin' ? (activeUser?.hotelId || selectedHotelId) : selectedHotelId;
    return messages.filter(m => {
      if (m.channel === 'internal' || m.senderRole !== 'cliente' || m.read) return false;
      if (activeUser?.rol === 'super_admin') return !hotelFilterId || m.hotelId === hotelFilterId;
      return m.hotelId === hotelFilterId;
    }).length;
  }, [messages, isStaff, selectedHotelId, activeUser?.rol, activeUser?.hotelId, activeUser?.id]);

  const unreadInternalCount = React.useMemo(() => {
    if (!isStaff) return 0;
    const hotelFilterId = activeUser?.rol !== 'super_admin' ? (activeUser?.hotelId || selectedHotelId) : selectedHotelId;
    return messages.filter(m => {
      if (m.channel !== 'internal' || m.senderRole === 'cliente' || m.read) return false;
      if (m.senderId === activeUser.id) return false;
      if (activeUser?.rol === 'super_admin') return !hotelFilterId || m.hotelId === hotelFilterId;
      return m.hotelId === hotelFilterId;
    }).length;
  }, [messages, isStaff, selectedHotelId, activeUser?.rol, activeUser?.hotelId, activeUser.id]);

  const totalUnreadCount = unreadGuestCount + unreadInternalCount;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messageHotelId = selectedHotelId || (isStaff && activeUser?.hotelId) || activeHotels[0]?.id;
    if (!messageHotelId) return;

    const isInternalMsg = isStaff && chatChannel === 'internal';

    // Construcción con asignación estricta de recipientId y customerId
    const newMsg: ChatMessage = {
      id: `MSG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      senderId: activeUser?.id || 'guest',
      senderName: activeUser ? `${activeUser.nombre} ${activeUser.apellido}`.trim() : 'Huésped',
      senderRole: activeUser?.rol || 'cliente',
      hotelId: messageHotelId,
      text: inputText.trim(),
      timestamp: new Date().toISOString(),
      read: false,
      channel: isInternalMsg ? 'internal' : 'guest',
      // Si es cliente, el customerId es su propio ID
      // Si es staff respondiendo a un cliente en guests tab, el recipientId y customerId es el cliente seleccionado
      customerId: !isStaff 
        ? (activeUser?.id || 'guest')
        : (!isInternalMsg ? selectedCustomerId : undefined),
      recipientId: isStaff && !isInternalMsg 
        ? selectedCustomerId 
        : undefined
    };

    onSendMessage(newMsg);
    setInputText('');

    // Al enviar mensaje propio, posicionarse al final para ver el nuevo mensaje
    forceScrollToBottom('smooth');
  };

  const activeHotel = hotels.find(h => h.id === selectedHotelId);
  const selectedClientObj = hotelClients.find(c => c.id === selectedCustomerId);

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* 1. FLOATING ACTION LAUNCH BUBBLE */}
      <button
        id="support-chat-bubble-launcher"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-transform active:scale-90 relative ${
          isOpen 
            ? 'bg-[#0E2A47] text-brand-cyan border border-brand-cyan/30' 
            : 'bg-brand-cyan text-[#071726] hover:bg-[#3fc2f0] hover:scale-105'
        }`}
        title={isStaff ? "Chat del Hotel: Huéspedes y Equipo Interno" : "Canal de Asistencia con Recepción"}
      >
        {isOpen ? (
          <X className="w-6 h-6 animate-fade-in" />
        ) : (
          <MessageCircle className="w-6 h-6 animate-pulse" />
        )}

        {/* Unread Alert Bullet Notification */}
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-650 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
            {totalUnreadCount}
          </span>
        )}
      </button>

      {/* 2. CHAT DRAWER PANEL CONTAINER */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.92 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onAnimationComplete={() => {
              forceScrollToBottom('auto');
            }}
            className="fixed sm:absolute bottom-20 sm:bottom-16 right-3 left-3 sm:left-auto sm:right-0 w-auto sm:w-[410px] max-w-[calc(100vw-24px)] h-[78vh] max-h-[560px] bg-[#071726] border border-[#0E2A47]/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-neutral-100 z-50"
          >
            {/* Dark Aesthetic Header */}
            <div className="bg-gradient-to-r from-[#0E2A47] to-[#071726] p-3.5 border-b border-[#0E2A47] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                  isStaff && chatChannel === 'internal'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-brand-cyan/10 border-brand-cyan/20 text-brand-cyan'
                }`}>
                  {isStaff && chatChannel === 'internal' ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${
                    isStaff && chatChannel === 'internal' 
                      ? 'text-amber-400' 
                      : (isStaff ? 'text-teal-400' : 'text-brand-cyan')
                  }`}>
                    {isStaff && chatChannel === 'internal' 
                      ? 'Chat Interno del Personal' 
                      : (isStaff ? 'Atención a Huéspedes' : 'Asistencia & Recepción')}
                  </h4>
                  <p className="text-[10px] text-brand-grey font-mono truncate max-w-[200px]">
                    {activeHotel?.nombre || 'Propiedad'}
                    {isStaff && chatChannel === 'guests' && selectedClientObj && (
                      <span className="text-teal-300 ml-1">• {selectedClientObj.name}</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white cursor-pointer transition-colors"
                title="Cerrar chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CHANNEL SELECTOR TABS (EXCLUSIVO PARA STAFF: ADMINS Y RECEPCIONISTAS) */}
            {isStaff && (
              <div className="bg-[#05111d] px-3 py-2 border-b border-[#0E2A47] flex items-center gap-2">
                <button
                  type="button"
                  id="tab-chat-guests"
                  onClick={() => setChatChannel('guests')}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    chatChannel === 'guests'
                      ? 'bg-brand-cyan text-slate-950 font-bold shadow-sm shadow-brand-cyan/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Huéspedes</span>
                  {unreadGuestCount > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                      {unreadGuestCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  id="tab-chat-internal"
                  onClick={() => setChatChannel('internal')}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    chatChannel === 'internal'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-sm shadow-amber-500/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Equipo Interno</span>
                  {unreadInternalCount > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                      {unreadInternalCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Target filters / hotel selection segment */}
            <div className="p-3 bg-slate-950/90 border-b border-slate-800/90 space-y-2 text-xs">
              {/* Hotel Select Filter */}
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                <span className="text-[10px] text-slate-400 font-medium">Propiedad:</span>
                <select
                  value={selectedHotelId}
                  disabled={isStaff && activeUser?.rol !== 'super_admin'}
                  onChange={(e) => {
                    setSelectedHotelId(e.target.value);
                    setSelectedCustomerId(''); // Reset customer on hotel change
                  }}
                  className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-neutral-200 focus:outline-none flex-1 max-w-[240px] disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isStaff && activeUser?.rol === 'super_admin' && !activeUser.hotelId && (
                    <option value="">-- Seleccionar Propiedad --</option>
                  )}
                  {activeHotels.map(h => (
                    <option key={h.id} value={h.id}>{h.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Para huéspedes: Banner indicador de confidencialidad y canal directo */}
              {!isStaff && (
                <div className="pt-1 border-t border-slate-900 flex items-center gap-2 text-[10.5px] text-teal-300/80 bg-teal-950/40 px-2.5 py-1.5 rounded-lg border border-teal-800/30">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="leading-tight">
                    Canal directo con la administración de <strong className="text-teal-200 font-semibold">{activeHotel?.nombre || 'este hotel'}</strong>. Tu conversación es privada y confidencial.
                  </span>
                </div>
              )}

              {/* Guests Channel: Client Selector (Staff side) */}
              {isStaff && chatChannel === 'guests' && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                  <User className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span className="text-[10px] text-slate-400 font-medium">Huésped:</span>
                  {hotelClients.length === 0 ? (
                    <span className="text-[10px] italic text-slate-500">Sin mensajes de huéspedes actualmente</span>
                  ) : (
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-teal-400 focus:outline-none flex-1 max-w-[240px]"
                    >
                      <option value="">Seleccionar Huésped...</option>
                      {hotelClients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.unreadCount > 0 ? ` (${c.unreadCount} sin leer)` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Internal Channel Banner: Explica la privacidad y lista miembros del equipo */}
              {isStaff && chatChannel === 'internal' && (
                <div className="pt-1.5 border-t border-slate-900 flex items-start gap-2 text-[10px] text-amber-300/80 bg-amber-500/5 p-2 rounded-lg border border-amber-500/20">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="leading-tight space-y-1">
                    <p className="font-semibold text-amber-300">
                      Canal privado exclusivo para Admin y Recepcionistas
                    </p>
                    <p className="text-slate-400 text-[9.5px]">
                      {hotelStaffMembers.length > 0
                        ? `${hotelStaffMembers.length} colaboradores enlazados a ${activeHotel?.nombre || 'esta propiedad'}. Ningún huésped puede ver este chat.`
                        : `Solo el personal administrativo de ${activeHotel?.nombre || 'esta propiedad'} puede interactuar aquí.`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 3. MESSAGE STREAM BLOCK */}
            <div className="flex-1 relative overflow-hidden flex flex-col bg-slate-900/60">
              <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
              >
                {filteredMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    {isStaff && chatChannel === 'internal' ? (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                          <Lock className="w-6 h-6 text-amber-400 animate-pulse" />
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-amber-300">Chat Interno sin Mensajes</h5>
                          <p className="text-[10px] text-slate-400 leading-normal max-w-[240px] mx-auto mt-1">
                            Usa este canal para coordinar entregas de llaves, novedades de habitaciones, cambios de turno o avisos administrativos con tu equipo de {activeHotel?.nombre || 'esta propiedad'}.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-10 h-10 text-slate-700 animate-pulse" />
                        <div>
                          <h5 className="font-bold text-xs text-slate-400">Canal Seguro Vacío</h5>
                          <p className="text-[10px] text-slate-500 leading-normal max-w-[220px] mx-auto mt-1">
                            {!isStaff 
                              ? `Envía un mensaje de texto para iniciar el chat interactivo directo con la recepción de ${activeHotel?.nombre || 'este hotel'}.`
                              : `Selecciona un huésped activo del listado para ver su historial de consultas.`}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  filteredMessages.map((msg, i) => {
                    const isMine = msg.senderId === activeUser.id;
                    const isSys = msg.senderId === 'system';
                    const isInternal = msg.channel === 'internal';
                    
                    if (isSys) {
                      return (
                        <div key={msg.id || i} className="flex justify-center">
                          <span className="bg-slate-950 text-teal-500/80 font-mono text-[9px] px-2.5 py-1 rounded-full border border-teal-950/40">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    // Helper badge label for roles in internal channel
                    const getRoleBadge = (role: UserRole) => {
                      if (role === 'super_admin') {
                        return <span className="bg-purple-900/50 text-purple-300 border border-purple-700/40 text-[8.5px] px-1.5 py-0.2 rounded font-medium">Super Admin</span>;
                      }
                      if (role === 'hotel_admin') {
                        return <span className="bg-amber-900/50 text-amber-300 border border-amber-700/40 text-[8.5px] px-1.5 py-0.2 rounded font-medium">Admin Hotel</span>;
                      }
                      if (role === 'recepcionista') {
                        return <span className="bg-teal-900/50 text-teal-300 border border-teal-700/40 text-[8.5px] px-1.5 py-0.2 rounded font-medium">Recepción</span>;
                      }
                      return null;
                    };

                    return (
                      <div
                        key={msg.id || i}
                        className={`flex flex-col max-w-[82%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                      >
                        {/* Name & Role Header */}
                        <div className={`text-[9.5px] text-slate-400 mb-1 flex items-center gap-1.5 ${isMine ? 'mr-1 flex-row-reverse' : 'ml-1'}`}>
                          <span className="font-medium text-slate-300">
                            {isMine ? 'Tú' : msg.senderName}
                          </span>
                          {isInternal && getRoleBadge(msg.senderRole)}
                          {!isInternal && !isMine && msg.senderRole !== 'cliente' && (
                            <ShieldCheck className="w-2.5 h-2.5 text-teal-400 inline" />
                          )}
                        </div>

                        {/* Bubble Box */}
                        <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isMine
                            ? isInternal
                              ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white rounded-br-xs font-medium border border-amber-500 shadow-sm shadow-amber-900/20'
                              : 'bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-br-xs font-medium border border-teal-550 shadow-sm shadow-teal-900/10'
                            : isInternal
                              ? 'bg-[#13273d] text-neutral-100 rounded-bl-xs border border-amber-500/20 shadow-sm'
                              : 'bg-slate-800 text-neutral-100 rounded-bl-xs border border-slate-700/60'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          
                          {/* Meta status & time */}
                          <div className="flex justify-end items-center gap-1 text-[9px] text-neutral-200/60 mt-1 font-mono">
                            <span>{formatTime(msg.timestamp)}</span>
                            {isMine && (
                              <CheckCheck className={`w-3 h-3 ${msg.read ? (isInternal ? 'text-amber-200' : 'text-teal-200') : 'text-neutral-400/40'}`} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Botón flotante para volver a los últimos mensajes */}
              <AnimatePresence>
                {showScrollBottom && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.85, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: 10 }}
                    onClick={() => {
                      isAtBottomRef.current = true;
                      scrollToBottom('smooth');
                    }}
                    className="absolute bottom-3 right-4 bg-[#0E2A47]/95 hover:bg-[#16385d] text-brand-cyan border border-brand-cyan/40 px-3 py-1.5 rounded-full shadow-2xl text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer z-10 active:scale-95 transition-all backdrop-blur-sm"
                    title="Ir al último mensaje"
                  >
                    <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
                    <span>Últimos mensajes</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* 4. CHAT FOOTER CONTROLS */}
            <form onSubmit={handleSend} className="p-3 bg-[#071726] border-t border-[#0E2A47]/60 flex gap-2 items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isStaff 
                    ? (chatChannel === 'internal'
                        ? `Mensaje interno para el equipo de ${activeHotel?.nombre || 'este hotel'}...`
                        : (!selectedCustomerId ? "Selecciona un huésped..." : `Responder a ${selectedClientObj?.name || 'huésped'}...`))
                    : `Escribe tu consulta a la recepción de ${activeHotel?.nombre || 'este hotel'}...`
                }
                disabled={isStaff && chatChannel === 'guests' && !selectedCustomerId}
                className="flex-1 text-xs bg-[#0E2A47]/60 border border-[#0E2A47]/40 rounded-xl px-3.5 py-2.5 text-white placeholder-brand-grey focus:outline-none focus:ring-1 focus:ring-brand-cyan focus:border-transparent disabled:opacity-45"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || (isStaff && chatChannel === 'guests' && !selectedCustomerId)}
                className={`p-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md ${
                  isStaff && chatChannel === 'internal'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                    : 'bg-brand-cyan hover:bg-[#3fc2f0] text-[#071726]'
                }`}
                title={isStaff && chatChannel === 'internal' ? "Enviar al equipo interno" : "Enviar mensaje"}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
