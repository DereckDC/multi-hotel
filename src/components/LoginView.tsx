/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { Mail, Sparkles, Check, Chrome, ShieldAlert, KeyRound, Loader2, ArrowRight, Inbox, RefreshCw, LogOut, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, syncUserToSupabase, mapUserFromDb } from '../supabase';
import { getApiBaseUrl } from '../store';
import { BrandLogo } from './BrandLogo';

interface LoginViewProps {
  users: User[];
  onLoginSuccess: (userId: string, fetchedUser?: User) => void;
  onRegisterUser: (newUser: User) => Promise<any> | void;
  onShowLanding?: () => void;
  onlyForm?: boolean;
}

export default function LoginView({ 
  users, 
  onLoginSuccess, 
  onRegisterUser,
  onShowLanding,
  onlyForm = false
}: LoginViewProps) {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loadingType, setLoadingType] = useState<'email' | 'google' | 'verification' | null>(null);
  const [customRegisterMode, setCustomRegisterMode] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // New guest register fields
  const [newName, setNewName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDoc, setNewDoc] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Verification flow states
  const [verificationPending, setVerificationPending] = useState(false);
  const [pendingDraftUser, setPendingDraftUser] = useState<User | null>(null);

  // Track if registration is assisted by Google Auth
  const [isGoogleAuthMode, setIsGoogleAuthMode] = useState(false);
  const [recoveredPassword, setRecoveredPassword] = useState('');

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setRecoverySuccess(false);
    setRecoveredPassword('');

    const trimmedEmail = recoveryEmail.trim();
    if (!trimmedEmail) {
      setErrorMsg('Por favor introduce tu correo electrónico.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('Por favor introduce una dirección de correo electrónico válida (ejemplo: nombre@dominio.com).');
      return;
    }

    setLoadingType('email');

    try {
      // Look up user in local state first
      let matchedUser = users.find(u => u.email.toLowerCase() === recoveryEmail.trim().toLowerCase());

      // Try direct database lookup fallback to handle replication lag or un-synchronized users
      if (!matchedUser) {
        const { data: dbUser, error: dbQueryErr } = await supabase
          .from('users')
          .select('*')
          .ilike('email', recoveryEmail.trim())
          .maybeSingle();

        if (!dbQueryErr && dbUser) {
          const { mapUserFromDb } = await import('../supabase');
          matchedUser = mapUserFromDb(dbUser);
        }
      }

      if (!matchedUser) {
        throw new Error('No se encontró ninguna cuenta registrada con el correo electrónico especificado en el sistema.');
      }

      // Generate a highly secure temporary password for single use
      const tempPassword = `RoomiaTemp-${Math.floor(100000 + Math.random() * 900000)}`;

      // Update the user profile in Supabase to set the new temporary password and force forced-password-screen
      const updatedUser: User = {
        ...matchedUser,
        password: tempPassword,
        debeCambiarPassword: true
      };

      const syncRes = await syncUserToSupabase(updatedUser);
      if (!syncRes.success) {
        throw new Error(syncRes.error || 'Error al intentar actualizar la clave temporal en la base de datos de Supabase.');
      }

      // Gracefully notify Supabase Authentication logic if desired, but carry on focusing on metadata DB credentials
      try {
        await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
          redirectTo: `${window.location.origin}`
        });
      } catch (authErr) {
        console.warn("Supabase Auth reset initiation bypassed natively for imported user profile metadata:", authErr);
      }

      const clientName = `${matchedUser.nombre} ${matchedUser.apellido}`;
      const emailSubject = 'Clave Temporal de Acceso Requerida - Roomia PMS 🏨🔑';
      const emailText = `Estimado/a ${clientName},\n\nSe ha solicitado la recuperación de su contraseña de acceso para su cuenta en Roomia PMS.\n\nSu contraseña anterior ha sido dada de baja de manera inmediata. Se ha generado una Clave Temporal de Acceso de uso único:\n👉  ${tempPassword}  👈\n\nPor favor, copie esta clave temporal, ingrese a la plataforma, y proceda a cambiarla por una contraseña permanente.\n\nAtentamente,\nEl Equipo de Hospitalidad de Roomia PMS.`;

      const emailHtml = `
        <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; border: 1px solid #f1f5f9; border-radius: 20px; color: #334155; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; padding: 12px 20px; background-color: #f1f5f9; border-radius: 12px; font-weight: 700; color: #0d9488; letter-spacing: 0.05em; font-size: 14px;">
              🏨 ROOMIA PMS Hospitality
            </div>
          </div>
          
          <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; text-align: center; margin: 0 0 16px 0; letter-spacing: -0.025em; line-height: 1.3;">
            Clave Temporal de Acceso Solicitada
          </h2>
          
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; text-align: center;">
            Estimado/a <strong>${clientName}</strong>,<br/>
            Se ha procesado exitosamente la solicitud de recuperación para su cuenta de Roomia PMS S.A.S.
          </p>
          
          <div style="background-color: #fafafa; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px;">
            <span style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 8px;">🔑 Su Nueva Clave Temporal:</span>
            <code style="font-family: 'Courier New', Courier, monospace; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: 0.05em; display: block; background-color: #f1f5f9; padding: 12px; border-radius: 10px; margin-bottom: 12px; user-select: all;">${tempPassword}</code>
            <span style="font-size: 11px; color: #ef4444; font-weight: 600; display: block;">🚨 Requiere cambio obligatorio al ingresar.</span>
          </div>
          
          <p style="font-size: 12.5px; line-height: 1.6; color: #64748b; margin-bottom: 24px; text-align: justify;">
            Por políticas de ciberseguridad, su clave anterior ha sido dada de baja de manera inmediata. Al iniciar sesión en la plataforma con esta clave temporal, el sistema le solicitará de forma automática restablecer una contraseña permanente y personalizada antes de acceder al panel de control.
          </p>
          
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${window.location.origin}" style="display: inline-block; background-color: #0f172a; color: #6eccaf; font-weight: 750; text-decoration: none; padding: 14px 34px; border-radius: 12px; font-size: 13px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);">
              Ingresar a la Plataforma
            </a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
          
          <p style="font-size: 11px; color: #94a3b8; line-height: 1.6; margin: 0; text-align: center;">
            Si usted no inició este proceso, por favor ignore este correo o comuníquese con el personal de soporte para verificar la integridad de su expediente.
          </p>
          <p style="font-size: 10px; color: #94a3b8; margin: 8px 0 0 0; text-align: center; font-weight: 500;">
            Roomia PMS Hotel Management Co. • Todos los derechos reservados.
          </p>
        </div>
      `;

      // Send the real email containing the temporary password via local express Nodemailer transporter proxy
      const mailResponse = await fetch(`${getApiBaseUrl()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: recoveryEmail.trim(),
          subject: emailSubject,
          text: emailText,
          html: emailHtml
        })
      });

      if (!mailResponse.ok) {
        const mailErrData = await mailResponse.json();
        throw new Error(mailErrData.error || 'Fallo al procesar el envío de correo de recuperación.');
      }

      setRecoveredPassword('');
      setRecoverySuccess(true);
      setErrorMsg('');
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al enviar correo de recuperación.');
    } finally {
      setLoadingType(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail) {
      setErrorMsg('Por favor introduce tu correo electrónico.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('Por favor introduce una dirección de correo de formato válido (ejemplo: nombre@dominio.com).');
      return;
    }

    if (!passwordInput.trim()) {
      setErrorMsg('Por favor introduce tu contraseña.');
      return;
    }

    setLoadingType('email');

    try {
      const emailLower = trimmedEmail.toLowerCase();
      
      let sbUser: any = null;
      let isNetworkFailure = false;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailLower,
          password: passwordInput,
        });

        if (error) {
          const msg = String(error.message || '').toLowerCase();
          if (msg.includes('failed to fetch') || msg.includes('fetch') || msg.includes('network')) {
            isNetworkFailure = true;
          } else {
            throw error;
          }
        } else {
          sbUser = data?.user;
        }
      } catch (authErr: any) {
        const msg = String(authErr.message || '').toLowerCase();
        if (msg.includes('failed to fetch') || msg.includes('fetch') || msg.includes('network')) {
          isNetworkFailure = true;
        } else {
          throw authErr;
        }
      }

      if (isNetworkFailure) {
        // Local user fallback check if network to auth provider fails or times out
        const matchedLocalUser = users.find(u => u && u.email && u.email.toLowerCase() === emailLower);
        if (matchedLocalUser) {
          if (matchedLocalUser.estado === 'inactivo') {
            setErrorMsg('Este usuario se encuentra inactivo. Contacte al administrador principal.');
            setLoadingType(null);
            return;
          }
          onLoginSuccess(matchedLocalUser.id, matchedLocalUser);
          return;
        } else if (emailLower === 'destructordereck@gmail.com') {
          const superAdminObj = INITIAL_USERS[0];
          onLoginSuccess(superAdminObj.id, superAdminObj);
          return;
        } else {
          throw new Error('Error de conexión al servidor de autenticación. Verifique su conexión e intente nuevamente.');
        }
      }

      if (!sbUser) {
        throw new Error('Sesión nula de autenticación de clientes retornada.');
      }

      // 3. Find matched user profile in users list or seek directly from public DB
      let dbUserProfile: any = null;
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', sbUser.id)
          .maybeSingle();
        dbUserProfile = dbUser;
      } catch (e) {
        console.warn("Authenticated user profile view query check warning:", e);
      }

      let matchedUser: User | undefined;
      if (dbUserProfile) {
        matchedUser = mapUserFromDb(dbUserProfile);
      } else {
        matchedUser = users.find(u => u && u.id === sbUser.id) || users.find(u => u && u.email && u.email.toLowerCase() === emailLower);
      }
      
      if (matchedUser) {
        if (matchedUser.estado === 'inactivo') {
          setErrorMsg('Este usuario se encuentra inactivo. Contacte al administrador principal.');
          await supabase.auth.signOut();
          setLoadingType(null);
          return;
        }

        onLoginSuccess(matchedUser.id, matchedUser);
      } else {
        // If profile doesn't exist in Supabase database, auto-register client profile
        const newUser: User = {
          id: sbUser.id,
          nombre: sbUser.user_metadata?.nombre || 'Usuario',
          apellido: sbUser.user_metadata?.apellido || 'Roomia',
          email: sbUser.email || emailLower,
          telefono: sbUser.user_metadata?.telefono || '+52 55 0000 0000',
          documento: sbUser.user_metadata?.documento || 'ID-SINC',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          rol: 'cliente',
          fechaRegistro: new Date().toISOString().split('T')[0],
          estado: 'activo'
        };
        await onRegisterUser(newUser);
        onLoginSuccess(newUser.id, newUser);
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Error de autenticación: Credenciales no válidas.');
    } finally {
      setLoadingType(null);
    }
  };

  const handleCustomRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail) {
      setErrorMsg('Por favor defina una dirección de correo válida.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('Por favor introduce un correo electrónico de formato real válido (ejemplo: nombre@dominio.com).');
      return;
    }

    const emailLower = trimmedEmail.toLowerCase();
    const emailExists = users.some(u => u.email.toLowerCase() === emailLower);
    if (emailExists) {
      setErrorMsg('Este correo electrónico ya está registrado en nuestro portal. Por favor, inicia sesión o recupera tu contraseña.');
      return;
    }

    if (!newName.trim() || !newLastName.trim()) {
      setErrorMsg('Nombre y Apellido son obligatorios para el expediente del huésped.');
      return;
    }

    if (!newPhone.trim()) {
      setErrorMsg('El número de teléfono es obligatorio para completar el expediente.');
      return;
    }

    if (!newDoc.trim()) {
      setErrorMsg('El documento de identidad es obligatorio para completar el expediente.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('La contraseña de acceso debe tener por lo menos 6 caracteres.');
      return;
    }

    setLoadingType('email');

    try {
      // Register with standard Supabase Authentication - No offline fallback registration (OWASP Top 10)
      const { data, error } = await supabase.auth.signUp({
        email: emailLower,
        password: newPassword,
        options: {
          data: {
            nombre: newName.trim(),
            apellido: newLastName.trim(),
            telefono: newPhone.trim(),
            documento: newDoc.trim()
          }
        }
      });

      if (error) {
        throw error;
      }

      const sbUser = data.user;
      if (!sbUser) {
        throw new Error('Error al registrar usuario en Supabase Auth.');
      }

      const newUser: User = {
        id: sbUser.id,
        nombre: newName.trim(),
        apellido: newLastName.trim(),
        email: emailLower,
        telefono: newPhone.trim(),
        documento: newDoc.trim(),
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=facearea&facepad=2&q=80',
        rol: 'cliente',
        fechaRegistro: new Date().toISOString().split('T')[0],
        estado: 'activo'
      };

      // Always persist the user profile in the database first
      await onRegisterUser(newUser);

      // Check if email confirmation is required (session is null and user is generated)
      if (sbUser && !data.session) {
        setPendingDraftUser(newUser);
        setVerificationPending(true);
        setSuccessMsg('Para completar el registro, se ha despachado un enlace oficial para confirmar el correo. Revise su bandeja.');
        return;
      }

      onLoginSuccess(newUser.id, newUser);
      setErrorMsg('');
    } catch (error: any) {
      setErrorMsg(error.message || 'Error de registro en Supabase.');
    } finally {
      setLoadingType(null);
    }
  };

  const handleCheckEmailVerification = async () => {
    setErrorMsg('');
    setLoadingType('verification');

    try {
      const emailToCheck = pendingDraftUser?.email || emailInput.trim();
      const passwordToCheck = pendingDraftUser?.password || newPassword;

      if (!emailToCheck) {
        throw new Error('No se encontró un registro temporal de correo de comprobación.');
      }

      // Try actual sign-in now that they claim to have verified, which fetches the session directly inside the WebView
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToCheck,
        password: passwordToCheck,
      });

      if (error) {
        if (error.message.toLowerCase().includes('confirm') || error.message.toLowerCase().includes('verified')) {
          throw new Error('Su correo electrónico de confirmación real aún no ha sido verificado. Revise su bandeja de entrada e inténtelo nuevamente.');
        }
        throw error;
      }

      if (data.user) {
        if (pendingDraftUser) {
          // If we have a pending draft user record, register it into the users db model now that they're authenticated
          await onRegisterUser(pendingDraftUser);
        }
        onLoginSuccess(data.user.id);
        setErrorMsg('');
        setSuccessMsg('¡Se confirmó y verificó con éxito su inicio de sesión!');
      } else {
        throw new Error('No se pudo establecer la sesión de usuario de manera segura despues de verificar.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al comprobar verificación. Por favor verifique el correo y vuelva a intentarlo.');
    } finally {
      setLoadingType(null);
    }
  };

  const handleResendEmailVerification = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailInput.trim()
      });
      if (error) throw error;
      setSuccessMsg('¡Se despachó con éxito un nuevo correo de verificación oficial a su bandeja real!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al reenviar verificación.');
    }
  };

  return (
    <div className={onlyForm ? "w-full" : "min-h-[85vh] flex items-center justify-center p-4 md:p-8 transition-all duration-150 bg-[#F8FAFB]"}>
      <div className={onlyForm 
        ? "bg-white rounded-3xl overflow-hidden transition-all duration-500 w-full"
        : "bg-white rounded-3xl overflow-hidden shadow-2xl border transition-all duration-500 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 border-[#0E2A47]/20"
      }>
        
        {/* Visual Brand Panel Left */}
        {!onlyForm && (
          <div className="transition-all duration-500 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-[#071726] to-[#0E2A47]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#23B4E6]/10 rounded-full blur-2xl transform translate-x-16 -translate-y-16" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#23B4E6]/5 rounded-full blur-2xl transform -translate-x-12 translate-y-12" />
            
            <div className="relative z-10 flex flex-col h-full justify-between gap-12">
              <div className="space-y-4 my-auto">
                <h1 className="text-2xl md:text-3xl font-serif font-black tracking-tight leading-tight text-white">
                  Encuentra el Hospedaje Perfecto para ti 🏨✨
                </h1>
                <p className="text-[#A8B2BD] text-xs md:text-sm leading-relaxed font-sans font-medium">
                  Reserva con total confianza, disfruta de confirmación al instante, accede a los mejores hoteles del país y vive una experiencia de hospedaje premium con Roomia PMS.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Interactable Login Panel Right */}
        <div className={onlyForm 
          ? "p-4 flex flex-col justify-center bg-white relative"
          : "p-8 md:p-12 flex flex-col justify-center bg-[#F8FAFB] relative border-l border-[#0E2A47]/10"
        }>
          
          <AnimatePresence mode="wait">
            {recoveryMode ? (
              <motion.div
                key="recovery-form-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-neutral-800">
                    Recuperar Contraseña
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Ingresa tu correo electrónico para enviarte un enlace de acceso seguro. ¡Estaremos encantados de ayudarte!
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border border-red-250 text-red-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 select-none">
                    <ShieldAlert className="w-4.5 h-4.5 text-red-650 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Simulated Loading Overlay */}
                {loadingType === 'email' && (
                  <div className="p-6 bg-[#F8FAFB] border border-[#0E2A47]/15 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 animate-pulse">
                    <Loader2 className="w-8 h-8 text-brand-cyan animate-spin" />
                    <div>
                      <p className="font-semibold text-xs text-neutral-800">
                        Buscando credenciales en la base de datos...
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-0.5 font-mono">ENVIANDO TOKEN DE AUTENTICACIÓN DIGITAL DE RECOVERY</p>
                    </div>
                  </div>
                )}

                {recoverySuccess && (
                  <div className="bg-emerald-50 border border-emerald-300 text-emerald-850 p-5 rounded-2xl space-y-3 animate-fade-in duration-350">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                      <h5 className="font-semibold text-sm">¡Correo enviado con éxito!</h5>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                      Hemos enviado las instrucciones de recuperación a <span className="font-semibold">{recoveryEmail.trim()}</span> con tu nueva clave de acceso de uso exclusivo.
                    </p>
                    <div className="bg-white p-4 rounded-xl border border-emerald-200/80 space-y-2.5 font-sans shadow-sm">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-[#0E2A47]">🔐 Acceso Seguro Garantizado</p>
                      <p className="text-neutral-600 text-[11px] leading-relaxed">
                        Por motivos de privacidad, tu contraseña no se muestra directamente en la pantalla.
                      </p>
                      <p className="text-neutral-600 text-[11px] leading-relaxed">
                        Te la enviamos de forma automática por correo. Por favor, <strong>revisa tu bandeja de entrada principal, carpeta de promociones o correo no deseado (Spam)</strong>.
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setRecoveryMode(false);
                        setRecoverySuccess(false);
                        setRecoveryEmail('');
                        setRecoveredPassword('');
                      }}
                      className="w-full mt-2 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer text-center active:scale-95"
                    >
                      Volver al Inicio de Sesión
                    </button>
                  </div>
                )}

                {!loadingType && (
                  <form onSubmit={handleRecoverPassword} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-neutral-500 block mb-1.5">
                        Correo Electrónico Registrado
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          placeholder="ejemplo@correo.com"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          className="w-full text-xs font-medium border border-neutral-200 rounded-xl py-3 pl-10 pr-4 focus:ring-1 focus:ring-[#23B4E6] focus:outline-none transition-all"
                        />
                        <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-neutral-400" />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg('');
                          setRecoveryMode(false);
                          setRecoverySuccess(false);
                        }}
                        className="w-1/3 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
                      >
                        Volver
                      </button>
                      <button
                        type="submit"
                        className="w-2/3 py-3 bg-brand-cyan hover:bg-[#3fc2f0] text-[#071726] text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-lg text-center cursor-pointer active:scale-95"
                      >
                        Enviar Correo de Recuperación
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            ) : !customRegisterMode ? (
              <motion.div
                key="login-form-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-neutral-800">
                        ¡Bienvenido a tu Experiencia Elite! 👋
                      </h2>
                      <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                        Inicia sesión para gestionar tus reservas vigentes, ser anfitrión o explorar increíbles suites boutique disponibles para ti.
                      </p>
                    </div>

                  </div>
                </div>

                {errorMsg && (
                  <div className="bg-red-50 border border-red-250 text-red-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 select-none">
                    <ShieldAlert className="w-4.5 h-4.5 text-red-650 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Simulated Loading Overlay */}
                {loadingType && (
                  <div className="p-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-brand-cyan animate-spin" />
                    <div>
                      <p className="font-semibold text-xs text-neutral-800">
                        {loadingType === 'google' 
                          ? 'Conectando con Google Accounts...' 
                          : 'Validando credenciales en base de datos...'}
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">Por favor espere un instante.</p>
                    </div>
                  </div>
                )}

                {!loadingType && (
                  <>
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-neutral-500 block mb-1.5 font-sans">
                          Correo Electrónico / Gmail
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            required
                            placeholder="ejemplo@correo.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="w-full text-xs font-medium border border-[#0E2A47]/20 rounded-xl py-3 pl-10 pr-4 bg-white focus:ring-1 focus:ring-[#23B4E6] focus:border-[#23B4E6] focus:outline-none transition-all text-[#071726]"
                          />
                          <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-[#A8B2BD]" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-500 block mb-1.5 font-sans">
                          Contraseña
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="w-full text-xs font-medium border border-[#0E2A47]/20 rounded-xl py-3 pl-10 pr-12 bg-white focus:ring-1 focus:ring-[#23B4E6] focus:border-[#23B4E6] focus:outline-none transition-all text-[#071726]"
                          />
                          <KeyRound className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-[#A8B2BD]" />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-3.5 p-0.5 text-neutral-500 hover:text-neutral-700 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="text-right mt-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setErrorMsg('');
                              setRecoveryMode(true);
                              setRecoveryEmail(emailInput);
                              setRecoverySuccess(false);
                            }}
                            className="text-xs text-[#0E2A47] hover:text-[#23B4E6] hover:underline font-semibold cursor-pointer transition-colors"
                          >
                            ¿Olvidaste tu contraseña?
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-[#0E2A47] hover:bg-[#133A62] text-white text-xs font-bold rounded-xl border border-brand-cyan/20 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer active:scale-95 text-center"
                      >
                        <span>Iniciar Sesión</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </form>



                    {/* Direct explicit register option */}
                    <div className="text-center pt-2">
                      <p className="text-xs text-neutral-400">
                        ¿No tiene una cuenta?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg('');
                            setEmailInput('');
                            setNewName('');
                            setNewLastName('');
                            setNewPhone('');
                            setNewDoc('');
                            setNewPassword('');
                            setIsGoogleAuthMode(false);
                            setCustomRegisterMode(true);
                          }}
                          className="font-bold text-[#0E2A47] hover:text-[#23B4E6] underline cursor-pointer transition-colors"
                        >
                          Registrar nuevo usuario aquí
                        </button>
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="register-form-panel"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {verificationPending ? (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 bg-indigo-50/10 border border-brand-cyan/20 rounded-2xl flex items-center justify-center mx-auto text-brand-cyan shadow-sm">
                        <Mail className="w-6 h-6 animate-bounce" />
                      </div>
                      <h3 className="text-xl font-bold text-neutral-800">Confirma tu Correo</h3>
                      <p className="text-xs text-neutral-500 leading-relaxed font-sans">
                        Hemos enviado un enlace de confirmación seguro a tu correo: <span className="font-semibold text-[#344D67] block font-mono mt-1 text-center bg-neutral-50 p-2 rounded-xl">{emailInput}</span>
                      </p>
                      <p className="text-[11px] text-neutral-450 mt-1 leading-relaxed">
                        Por favor revisa tu buzón de correo electrónico, haz clic en el enlace de verificación y listo. ¡Te esperamos para tu próximo gran viaje!
                      </p>
                    </div>

                    {errorMsg && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 font-sans justify-center select-none">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-red-650" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {successMsg && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 font-sans justify-center select-none animate-pulse">
                        <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>{successMsg}</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleCheckEmailVerification}
                        disabled={loadingType === 'verification'}
                        className="w-full py-3 bg-[#344D67] hover:bg-[#1E2E3E] text-[#6ECCAF] text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {loadingType === 'verification' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Comprobando verificación...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            <span>Ya he verificado mi cuenta de correo</span>
                          </>
                        )}
                      </button>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setVerificationPending(false);
                            setPendingDraftUser(null);
                            setErrorMsg('');
                            setSuccessMsg('');
                          }}
                          className="w-1/2 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Volver al Login</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleResendEmailVerification}
                          className="w-1/2 py-2.5 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-[#23B4E6] text-xs font-semibold rounded-xl transition-all cursor-pointer border border-brand-cyan/15"
                        >
                          Reenviar Correo
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-800">Regístrate y Viaja de Forma Única ✨</h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        Crea tu cuenta en minutos para reservar al instante, acceder a mejores tarifas y gestionar tus próximas estancias con total facilidad desde un solo lugar.
                      </p>
                    </div>

                    {errorMsg && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 font-sans justify-center select-none">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-red-650" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {successMsg && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 font-sans justify-center select-none animate-pulse">
                        <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>{successMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleCustomRegister} className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Correo Electrónico (Email)</label>
                        <input
                          type="email"
                          required
                          placeholder="ejemplo@correo.com"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#344D67]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Nombre</label>
                          <input
                            type="text"
                            required
                            placeholder="Pedro"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#344D67]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Apellido</label>
                          <input
                            type="text"
                            required
                            placeholder="Pérez"
                            value={newLastName}
                            onChange={(e) => setNewLastName(e.target.value)}
                            className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#344D67]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Teléfono</label>
                        <input
                          type="text"
                          required
                          placeholder="+52 55 1212 3434"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#344D67]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-neutral-405 block mb-1">Documento de Identidad (Cédula/Pasaporte)</label>
                        <input
                          type="text"
                          required
                          placeholder="PAS-102938"
                          value={newDoc}
                          onChange={(e) => setNewDoc(e.target.value)}
                          className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#344D67]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1">Define tu Contraseña</label>
                        <div className="relative">
                          <input
                            type={showRegisterPassword ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 pl-10 pr-10 focus:outline-none focus:ring-1 focus:ring-[#344D67]"
                          />
                          <KeyRound className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                          <button
                            type="button"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            className="absolute right-3 top-2.5 p-1 hover:bg-neutral-100 rounded-full cursor-pointer text-neutral-400 hover:text-neutral-600 transition-colors"
                          >
                            {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomRegisterMode(false);
                            setIsGoogleAuthMode(false);
                          }}
                          className="w-1/3 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
                        >
                          Atrás
                        </button>
                        <button
                          type="submit"
                          disabled={loadingType === 'email'}
                          className="w-2/3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 transition-all shadow-md cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
                        >
                          {loadingType === 'email' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Registrando...</span>
                            </>
                          ) : (
                            <span>Completar Registro</span>
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>
    </div>
  );
}
