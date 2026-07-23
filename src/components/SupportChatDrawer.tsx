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
  ShieldCheck, 
  CheckCheck, 
  Building2, 
  Bell, 
  Dot, 
  MessageCircle 
} from 'lucide-react';
import { Hotel, User as UserType, ChatMessage, UserRole } from '../types';
import { sortMessagesChronologically } from '../utils/chatUtils';

interface SupportChatDrawerProps {
  hotels: Hotel[];
  activeUser: UserType;
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
  onMarkAsRead: (hotelId: string, senderId: string, role: UserRole) => void;
  openHotelId?: string | null;
}

export default function SupportChatDrawer({
  hotels,
  activeUser,
  messages,
  onSendMessage,
  onMarkAsRead,
  openHotelId
}: SupportChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isStaff = activeUser?.rol ? activeUser.rol !== 'cliente' : false;

  // Get active and available hotels - restringe si es staff de hotel (no super admin)
  const activeHotels = React.useMemo(() => {
    return hotels.filter(h => {
      if (h.estado !== 'activo') return false;
      if (isStaff && activeUser?.rol !== 'super_admin') {
        return h.id === activeUser?.hotelId;
      }
      return true;
    });
  }, [hotels, isStaff, activeUser?.hotelId, activeUser?.rol]);

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

  // Filter messages based on role and selected targets, sorted with millisecond precision
  const getFilteredMessages = () => {
    const hotelFilterId = isStaff && activeUser.rol !== 'super_admin' ? activeUser.hotelId : selectedHotelId;
    let raw: ChatMessage[] = [];
    if (!isStaff) {
      // Clients see their chat history with the selected hotel
      raw = messages.filter(m => m.hotelId === hotelFilterId && (m.senderId === activeUser.id || m.senderId === 'system' || (m.senderRole !== 'cliente' && m.senderId !== activeUser.id)));
    } else {
      // Staff see chat history between the selected hotel and selected customer
      if (!selectedCustomerId) return [];
      raw = messages.filter(m => m.hotelId === hotelFilterId && (m.senderId === selectedCustomerId || (m.senderRole === 'cliente' && m.senderId === selectedCustomerId) || (m.senderRole !== 'cliente' && m.hotelId === hotelFilterId)));
    }
    return sortMessagesChronologically(raw);
  };

  const filteredMessages = getFilteredMessages();

  // Get unique clients who have started chats with the selected hotel (for staff selection)
  const hotelClients = React.useMemo(() => {
    const hotelFilterId = isStaff && activeUser.rol !== 'super_admin' ? activeUser.hotelId : selectedHotelId;
    if (!hotelFilterId) return [];
    const clientIds = new Set<string>();
    const clients: { id: string; name: string }[] = [];

    messages
      .filter(m => m.hotelId === hotelFilterId && m.senderRole === 'cliente')
      .forEach(m => {
        if (!clientIds.has(m.senderId)) {
          clientIds.add(m.senderId);
          clients.push({ id: m.senderId, name: m.senderName });
        }
      });

    return clients;
  }, [messages, selectedHotelId, isStaff, activeUser.hotelId, activeUser.rol]);

  // If staff and no customer selected, default to the first client in list
  useEffect(() => {
    if (isStaff && !selectedCustomerId && hotelClients.length > 0) {
      setSelectedCustomerId(hotelClients[0].id);
    }
  }, [isStaff, hotelClients, selectedCustomerId]);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [filteredMessages, isOpen]);

  // Mark incoming messages as read when drawer is open
  useEffect(() => {
    if (isOpen && selectedHotelId) {
      if (!isStaff) {
        // Client marks messages from hotel staff as read
        const unreadStaffMessages = messages.filter(m => m.hotelId === selectedHotelId && m.senderRole !== 'cliente' && !m.read);
        if (unreadStaffMessages.length > 0) {
          onMarkAsRead(selectedHotelId, unreadStaffMessages[0].senderId, unreadStaffMessages[0].senderRole);
        }
      } else if (selectedCustomerId) {
        // Staff marks messages from this specific client as read
        const unreadClientMessages = messages.filter(m => m.hotelId === selectedHotelId && m.senderId === selectedCustomerId && m.senderRole === 'cliente' && !m.read);
        if (unreadClientMessages.length > 0) {
          onMarkAsRead(selectedHotelId, selectedCustomerId, 'cliente');
        }
      }
    }
  }, [isOpen, messages, selectedHotelId, selectedCustomerId, isStaff, onMarkAsRead]);

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

  // Calculate global unread system message notification count
  const getUnreadCount = () => {
    if (!isStaff) {
      // Client unread count: messages sent by staff to this client that are unread
      return messages.filter(m => m.senderRole !== 'cliente' && m.hotelId === selectedHotelId && !m.read).length;
    } else {
      // Staff unread count: messages sent by clients to their assigned hotel (or any hotel if super admin)
      return messages.filter(m => {
        if (m.senderRole !== 'cliente' || m.read) return false;
        if (activeUser?.rol === 'super_admin') return true;
        return m.hotelId === activeUser?.hotelId;
      }).length;
    }
  };

  const unreadCount = getUnreadCount();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const messageHotelId = selectedHotelId || (isStaff && activeUser?.hotelId) || activeHotels[0]?.id;
    if (!messageHotelId) return;

    const newMsg: ChatMessage = {
      id: `MSG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      senderId: activeUser?.id || 'guest',
      senderName: activeUser ? `${activeUser.nombre} ${activeUser.apellido}` : 'Invitado',
      senderRole: activeUser?.rol || 'cliente',
      hotelId: messageHotelId,
      text: inputText.trim(),
      timestamp: new Date().toISOString(),
      read: false
    };

    onSendMessage(newMsg);
    setInputText('');
  };

  const activeHotel = hotels.find(h => h.id === selectedHotelId);

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
        title="Canal de Asistencia & Chat en Tiempo Real"
      >
        {isOpen ? (
          <X className="w-6 h-6 animate-fade-in" />
        ) : (
          <MessageCircle className="w-6 h-6 animate-pulse" />
        )}

        {/* Unread Alert Bullet Notification */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-650 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* 2. CHAT DRAWER PANEL CONTAINER MAP */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.92 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed sm:absolute bottom-20 sm:bottom-16 right-3 left-3 sm:left-auto sm:right-0 w-auto sm:w-96 max-w-[calc(100vw-24px)] h-[75vh] max-h-[520px] bg-[#071726] border border-[#0E2A47]/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-neutral-100 z-50"
          >
            {/* Dark Aesthetic Header */}
            <div className="bg-gradient-to-r from-[#0E2A47] to-[#071726] p-4 border-b border-[#0E2A47] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-brand-cyan" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-cyan">Asistencia de Huéspedes</h4>
                  <p className="text-[10px] text-brand-grey font-mono">Los mensajes son temporales y solo duraran 24h</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector/Target filters segment */}
            <div className="p-3 bg-slate-950/80 border-b border-slate-800 space-y-2 text-xs">
              {/* Hotel Select Filter */}
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                <span className="text-[10px] text-slate-400 font-medium">Hotel:</span>
                <select
                  value={selectedHotelId}
                  disabled={isStaff && activeUser?.rol !== 'super_admin'}
                  onChange={(e) => {
                    setSelectedHotelId(e.target.value);
                    setSelectedCustomerId(''); // Reset customer on hotel change
                  }}
                  className="bg-slate-900 border border-slate-850 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none flex-1 max-w-[200px] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isStaff && !activeUser.hotelId && (
                    <option value="">-- Todos los Hoteles --</option>
                  )}
                  {activeHotels.map(h => (
                    <option key={h.id} value={h.id}>{h.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Client Conversation Selector (Staff side) */}
              {isStaff && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                  <User className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                  <span className="text-[10px] text-slate-400 font-medium">Conversación:</span>
                  {hotelClients.length === 0 ? (
                    <span className="text-[10px] italic text-slate-500">Sin mensajes del cliente actualmente</span>
                  ) : (
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="bg-slate-900 border border-slate-850 rounded px-2 py-1 text-xs text-teal-400 focus:outline-none flex-1 max-w-[200px]"
                    >
                      <option value="">Seleccionar Huésped...</option>
                      {hotelClients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* 3. MESSAGE STREAM BLOCK */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900/60 custom-scrollbar">
              {filteredMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <MessageSquare className="w-10 h-10 text-slate-700 animate-pulse" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-400">Canal Seguro Vacío</h5>
                    <p className="text-[10px] text-slate-500 leading-normal max-w-[200px] mx-auto mt-1">
                      {!isStaff 
                        ? `Envía un mensaje de texto para iniciar el chat interactivo directo con el mostrada o recepcionista de ${activeHotel?.nombre || 'este hotel'}.`
                        : `Selecciona un huésped activo del listado para ver su historial de ayuda.`}
                    </p>
                  </div>
                </div>
              ) : (
                filteredMessages.map((msg, i) => {
                  const isMine = msg.senderId === activeUser.id;
                  const isSys = msg.senderId === 'system';
                  
                  if (isSys) {
                    return (
                      <div key={msg.id || i} className="flex justify-center">
                        <span className="bg-slate-950 text-teal-500/80 font-mono text-[9px] px-2.5 py-1 rounded-full border border-teal-950/40">
                          {msg.text}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id || i}
                      className={`flex flex-col max-w-[80%] ${isMine ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      {/* Name badge if not me */}
                      {!isMine && (
                        <span className="text-[9px] text-slate-400 ml-1.5 mb-0.5 flex items-center gap-1">
                          {msg.senderRole !== 'cliente' ? <ShieldCheck className="w-2.5 h-2.5 text-teal-400 inline" /> : null}
                          {msg.senderName}
                        </span>
                      )}

                      {/* Bubble box */}
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        isMine
                          ? 'bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-br-xs font-medium border border-teal-550 shadow-sm shadow-teal-900/10'
                          : 'bg-slate-800 text-neutral-100 rounded-bl-xs border border-slate-700/60'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        
                        {/* Meta status & time */}
                        <div className="flex justify-end items-center gap-1 text-[9px] text-neutral-200/60 mt-1 font-mono">
                          <span>{formatTime(msg.timestamp)}</span>
                          {isMine && (
                            <CheckCheck className={`w-3 h-3 ${msg.read ? 'text-teal-200' : 'text-neutral-400/40'}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 4. CHAT FOOTER CONTROLS */}
            <form onSubmit={handleSend} className="p-3 bg-[#071726] border-t border-[#0E2A47]/60 flex gap-2 items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isStaff && !selectedCustomerId 
                    ? "Selecciona un cliente..." 
                    : "Escribe tu mensaje..."
                }
                disabled={isStaff && !selectedCustomerId}
                className="flex-1 text-xs bg-[#0E2A47]/60 border border-[#0E2A47]/40 rounded-xl px-3.5 py-2.5 text-white placeholder-brand-grey focus:outline-none focus:ring-1 focus:ring-brand-cyan focus:border-transparent disabled:opacity-45"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || (isStaff && !selectedCustomerId)}
                className="p-2.5 bg-brand-cyan hover:bg-[#3fc2f0] text-[#071726] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
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
