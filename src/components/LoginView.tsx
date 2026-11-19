/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User } from '../types';
import { Mail, Check, Chrome, ShieldAlert, KeyRound, Loader2, ArrowRight, Inbox, RefreshCw, LogOut, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, syncUserToSupabase, mapUserFromDb, isEmailRegistered } from '../supabase';
import { getApiBaseUrl } from '../store';
import { getPublicOrigin } from '../utils/platform';
import { friendlyError } from '../utils/errors';
import { BrandLogo } from './BrandLogo';
import { Button, BackButton } from './ui';

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
      setErrorMsg('Escribe tu correo electrónico.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('Escribe un correo electrónico válido (ejemplo: nombre@dominio.com).');
      return;
    }

    setLoadingType('email');

    try {
      // Trigger official secure reset link via Supabase Auth without sending plain-text passwords
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: getPublicOrigin()
      });

      if (error) {
        throw error;
      }

      setRecoveredPassword('');
      setRecoverySuccess(true);
      setErrorMsg('');
    } catch (error: any) {
      setErrorMsg(friendlyError(error, 'recuperar'));
    } finally {
      setLoadingType(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail) {
      setErrorMsg('Escribe tu correo electrónico.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('Escribe un correo electrónico válido (ejemplo: nombre@dominio.com).');
      return;
    }

    if (!passwordInput.trim()) {
      setErrorMsg('Escribe tu contraseña.');
      return;
    }

    setLoadingType('email');

    try {
      const emailLower = trimmedEmail.toLowerCase();
      let matchedUser: User | undefined;
      let authenticatedViaSupabase = false;

      // 1. Try Supabase Auth sign in
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailLower,
          password: passwordInput,
        });

        if (!error && data?.user) {
          authenticatedViaSupabase = true;
          const sbUser = data.user;
          // Try fetching profile from DB
          try {
            const { data: dbUser } = await supabase
              .from('users')
              .select('*')
              .eq('id', sbUser.id)
              .maybeSingle();
            if (dbUser) {
              matchedUser = mapUserFromDb(dbUser);
            }
          } catch (e) {
            console.warn('Profile fetch warning:', e);
          }
          if (!matchedUser) {
            matchedUser = users.find(u => u && (u.id === sbUser.id || u.email?.toLowerCase() === emailLower));
          }
          if (!matchedUser) {
            matchedUser = {
              id: sbUser.id,
              nombre: sbUser.user_metadata?.nombre || 'Usuario',
              apellido: sbUser.user_metadata?.apellido || '',
              email: sbUser.email || emailLower,
              telefono: sbUser.user_metadata?.telefono || '',
              documento: sbUser.user_metadata?.documento || '',
              avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              rol: 'cliente',
              fechaRegistro: new Date().toISOString().split('T')[0],
              estado: 'activo'
            };
            await onRegisterUser(matchedUser);
          }
        }
      } catch (authErr) {
        console.warn('Supabase Auth sign-in attempt warning:', authErr);
      }

      // 2. If Supabase Auth did not authenticate the user, verify candidate credentials strictly
      if (!authenticatedViaSupabase) {
        let candidateUser: User | undefined;
        try {
          const { data: dbUser } = await supabase
            .from('users')
            .select('*')
            .ilike('email', emailLower)
            .maybeSingle();
          if (dbUser) {
            candidateUser = mapUserFromDb(dbUser);
          }
        } catch (e) {
          console.warn('Database user search warning:', e);
        }

        if (!candidateUser) {
          candidateUser = users.find(u => u && u.email && u.email.toLowerCase() === emailLower);
        }

        if (candidateUser) {
          // If the candidate user has a specific local password (e.g. temporary password set during reset)
          if (candidateUser.password) {
            if (candidateUser.password === passwordInput) {
              matchedUser = candidateUser;
            } else {
              throw new Error('Correo electrónico o contraseña incorrectos.');
            }
          } else {
            // User exists in system, but Supabase Auth rejected credentials and no matching local password exists.
            throw new Error('Correo electrónico o contraseña incorrectos.');
          }
        } else {
          // User not found at all
          throw new Error('Correo electrónico o contraseña incorrectos. Si no tienes cuenta, por favor regístrate.');
        }
      }

      if (matchedUser) {
        if (matchedUser.estado === 'inactivo') {
          setErrorMsg('Esta cuenta está inactiva. Comunícate con el administrador.');
          setLoadingType(null);
          return;
        }
        onLoginSuccess(matchedUser.id, matchedUser);
      } else {
        throw new Error('Correo electrónico o contraseña incorrectos.');
      }
    } catch (error: any) {
      setErrorMsg(friendlyError(error, 'login'));
    } finally {
      setLoadingType(null);
    }
  };

  const handleCustomRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail) {
      setErrorMsg('Escribe una dirección de correo válida.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMsg('Escribe un correo electrónico válido (ejemplo: nombre@dominio.com).');
      return;
    }

    const emailLower = trimmedEmail.toLowerCase();
    let emailExists = users.some(u => u && u.email && u.email.toLowerCase() === emailLower);
    if (!emailExists) {
      // Sin sesión no se puede leer la tabla de usuarios: se consulta al servidor,
      // que solo responde si el correo existe o no.
      emailExists = (await isEmailRegistered(emailLower)) === true;
    }
    if (emailExists) {
      setErrorMsg('Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.');
      return;
    }

    if (!newName.trim() || !newLastName.trim()) {
      setErrorMsg('Escribe tu nombre y apellido.');
      return;
    }

    if (!newPhone.trim()) {
      setErrorMsg('Escribe tu número de teléfono.');
      return;
    }

    if (!newDoc.trim()) {
      setErrorMsg('Escribe tu documento de identidad.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoadingType('email');

    try {
      let sbUserId = `user-${Date.now()}`;
      let isConfirmedSession = true;

      // Attempt Supabase Auth registration
      try {
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

        if (!error && data?.user) {
          sbUserId = data.user.id;
          if (!data.session) {
            isConfirmedSession = false;
          }
        }
      } catch (authErr) {
        console.warn('Supabase Auth signUp warning (falling back to direct DB record):', authErr);
      }

      const newUser: User = {
        id: sbUserId,
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

      // Always persist the user profile in the Supabase database
      await onRegisterUser(newUser);

      if (!isConfirmedSession) {
        setPendingDraftUser(newUser);
        setVerificationPending(true);
        setSuccessMsg('Para completar tu registro, te enviamos un enlace de confirmación. Revisa tu bandeja de entrada.');
        return;
      }

      onLoginSuccess(newUser.id, newUser);
      setErrorMsg('');
    } catch (error: any) {
      setErrorMsg(friendlyError(error, 'registro'));
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
        throw new Error('No encontramos tu registro temporal. Vuelve a registrarte.');
      }

      // Try actual sign-in now that they claim to have verified, which fetches the session directly inside the WebView
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToCheck,
        password: passwordToCheck,
      });

      if (error) {
        if (error.message.toLowerCase().includes('confirm') || error.message.toLowerCase().includes('verified')) {
          throw new Error('Aún no confirmas tu correo. Abre el enlace que te enviamos y vuelve a intentarlo.');
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
        setSuccessMsg('¡Listo! Confirmamos tu correo y ya puedes ingresar.');
      } else {
        throw new Error('No pudimos iniciar tu sesión después de verificar. Inténtalo de nuevo.');
      }
    } catch (err: any) {
      setErrorMsg(friendlyError(err, 'verificacion'));
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
      setSuccessMsg('Te enviamos un nuevo correo de verificación. Revisa tu bandeja de entrada.');
    } catch (err: any) {
      setErrorMsg(friendlyError(err, 'verificacion'));
    }
  };

  return (
    <div className={onlyForm ? "w-full" : "min-h-[85vh] flex items-center justify-center p-4 md:p-8 transition-all duration-150 bg-[#F8FAFB]"}>
      <div className={onlyForm 
        ? "bg-white rounded-2xl overflow-hidden transition-all duration-500 w-full"
        : "bg-white rounded-2xl overflow-hidden shadow-xl border transition-all duration-500 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 border-brand-navy1/20"
      }>
        
        {/* Visual Brand Panel Left */}
        {!onlyForm && (
          <div className="transition-all duration-500 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-brand-navy2 to-brand-navy1">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/10 rounded-full blur-2xl transform translate-x-16 -translate-y-16" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-cyan/5 rounded-full blur-2xl transform -translate-x-12 translate-y-12" />
            
            <div className="relative z-10 flex flex-col h-full justify-between gap-12">
              <div className="space-y-4 my-auto">
                <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight leading-tight text-white">
                  Encuentra el hospedaje perfecto para ti
                </h1>
                <p className="text-[#A8B2BD] text-xs md:text-sm leading-relaxed font-medium">
                  Reserva con total confianza, disfruta de confirmación al instante, accede a los mejores hoteles del país y vive una experiencia de hospedaje premium con Roomia PMS.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Interactable Login Panel Right */}
        <div className={onlyForm 
          ? "p-4 flex flex-col justify-center bg-white relative"
          : "p-8 md:p-12 flex flex-col justify-center bg-[#F8FAFB] relative border-l border-brand-navy1/10"
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
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-2xl font-bold tracking-tight text-neutral-800">
                      Recuperar contraseña
                    </h3>
                    <BackButton
                      tone="light"
                      onClick={() => {
                        setErrorMsg('');
                        setRecoveryMode(false);
                        setRecoverySuccess(false);
                      }}
                    />
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    Ingresa tu correo electrónico para enviarte un enlace de acceso seguro. ¡Estaremos encantados de ayudarte!
                  </p>
                </div>

                {errorMsg && (
                  <div className="bg-danger-50 border border-danger-200 text-danger-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 select-none">
                    <ShieldAlert className="w-4.5 h-4.5 text-danger-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Simulated Loading Overlay */}
                {loadingType === 'email' && (
                  <div className="p-6 bg-[#F8FAFB] border border-brand-navy1/15 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 animate-pulse">
                    <Loader2 className="w-8 h-8 text-brand-cyan animate-spin" />
                    <div>
                      <p className="font-semibold text-xs text-neutral-800">
                        Enviando el correo de recuperación…
                      </p>
                      <p className="text-micro text-neutral-500 mt-0.5">Esto toma unos segundos.</p>
                    </div>
                  </div>
                )}

                {recoverySuccess && (
                  <div className="bg-success-50 border border-success-300 text-success-800 p-5 rounded-2xl space-y-3 animate-fade-in duration-350">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-5 h-5 text-success-600 shrink-0" />
                      <h5 className="font-semibold text-sm">¡Correo enviado con éxito!</h5>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed ">
                      Hemos enviado las instrucciones de recuperación a <span className="font-semibold">{recoveryEmail.trim()}</span> con tu nueva clave de acceso de uso exclusivo.
                    </p>
                    <div className="bg-white p-4 rounded-xl border border-success-200/80 space-y-2.5 shadow-sm">
                      <p className="text-micro uppercase tracking-wider font-bold text-brand-navy1">Acceso seguro</p>
                      <p className="text-neutral-600 text-micro leading-relaxed">
                        Por motivos de privacidad, tu contraseña no se muestra directamente en la pantalla.
                      </p>
                      <p className="text-neutral-600 text-micro leading-relaxed">
                        Te la enviamos de forma automática por correo. Por favor, <strong>revisa tu bandeja de entrada principal, carpeta de promociones o correo no deseado (Spam)</strong>.
                      </p>
                    </div>
                    
                    <Button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setRecoveryMode(false);
                        setRecoverySuccess(false);
                        setRecoveryEmail('');
                        setRecoveredPassword('');
                      }}
                      variant="primary" size="md" className="w-full mt-2"
                    >
                      Iniciar sesión
                    </Button>
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
                          className="w-full text-xs font-medium border border-neutral-200 rounded-xl py-3 pl-10 pr-4 focus:ring-1 focus:ring-brand-cyan focus:outline-none transition-all"
                        />
                        <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-neutral-400" />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        type="submit"
                        variant="accent" size="md" className="w-full"
                      >
                        Enviar correo de recuperación
                      </Button>
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
                        ¡Bienvenido a Roomia PMS!
                      </h2>
                      <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                        Inicia sesión para gestionar tus reservas vigentes, ser anfitrión o explorar increíbles suites boutique disponibles para ti.
                      </p>
                    </div>

                  </div>
                </div>

                {errorMsg && (
                  <div className="bg-danger-50 border border-danger-200 text-danger-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 select-none">
                    <ShieldAlert className="w-4.5 h-4.5 text-danger-600 shrink-0" />
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
                          : 'Verificando tus datos…'}
                      </p>
                      <p className="text-micro text-neutral-400 mt-0.5">Espera un instante.</p>
                    </div>
                  </div>
                )}

                {!loadingType && (
                  <>
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-neutral-500 block mb-1.5 ">
                          Correo Electrónico / Gmail
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            required
                            placeholder="ejemplo@correo.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="w-full text-xs font-medium border border-brand-navy1/20 rounded-xl py-3 pl-10 pr-4 bg-white focus:ring-1 focus:ring-brand-cyan focus:border-brand-cyan focus:outline-none transition-all text-brand-navy2"
                          />
                          <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-[#A8B2BD]" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-500 block mb-1.5 ">
                          Contraseña
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="w-full text-xs font-medium border border-brand-navy1/20 rounded-xl py-3 pl-10 pr-12 bg-white focus:ring-1 focus:ring-brand-cyan focus:border-brand-cyan focus:outline-none transition-all text-brand-navy2"
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
                            className="text-xs text-brand-navy1 hover:text-brand-cyan hover:underline font-semibold cursor-pointer transition-colors"
                          >
                            ¿Olvidaste tu contraseña?
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        variant="primary" size="md" className="w-full"
                      >
                        <span>Iniciar Sesión</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
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
                          className="font-bold text-brand-navy1 hover:text-brand-cyan underline cursor-pointer transition-colors"
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
                    <div className="flex justify-end">
                      <BackButton
                        tone="light"
                        onClick={() => {
                          setVerificationPending(false);
                          setPendingDraftUser(null);
                          setErrorMsg('');
                          setSuccessMsg('');
                        }}
                      />
                    </div>
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 bg-info-50/10 border border-brand-cyan/20 rounded-2xl flex items-center justify-center mx-auto text-brand-cyan shadow-sm">
                        <Mail className="w-6 h-6 animate-bounce" />
                      </div>
                      <h3 className="text-xl font-bold text-neutral-800">Confirma tu Correo</h3>
                      <p className="text-xs text-neutral-500 leading-relaxed ">
                        Hemos enviado un enlace de confirmación seguro a tu correo: <span className="font-semibold text-neutral-700 block font-mono mt-1 text-center bg-neutral-50 p-2 rounded-xl">{emailInput}</span>
                      </p>
                      <p className="text-micro text-neutral-400 mt-1 leading-relaxed">
                        Por favor revisa tu buzón de correo electrónico, haz clic en el enlace de verificación y listo. ¡Te esperamos para tu próximo gran viaje!
                      </p>
                    </div>

                    {errorMsg && (
                      <div className="bg-danger-50 border border-danger-200 text-danger-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 justify-center select-none">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-danger-600" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {successMsg && (
                      <div className="bg-success-50 border border-success-200 text-success-800 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 justify-center select-none animate-pulse">
                        <Check className="w-4 h-4 shrink-0 text-success-600" />
                        <span>{successMsg}</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleCheckEmailVerification}
                        disabled={loadingType === 'verification'}
                        className="w-full py-3 bg-neutral-700 hover:bg-[#1E2E3E] text-[#6ECCAF] text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
                          onClick={handleResendEmailVerification}
                          className="w-full py-2.5 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-navy1 text-sm font-semibold rounded-xl transition-all cursor-pointer border border-brand-cyan/30"
                        >
                          Reenviar Correo
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-800">Regístrate y reserva a tu manera</h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        Crea tu cuenta en minutos para reservar al instante, acceder a mejores tarifas y gestionar tus próximas estancias con total facilidad desde un solo lugar.
                      </p>
                    </div>

                    {errorMsg && (
                      <div className="bg-danger-50 border border-danger-200 text-danger-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 justify-center select-none">
                        <ShieldAlert className="w-4 h-4 shrink-0 text-danger-600" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {successMsg && (
                      <div className="bg-success-50 border border-success-200 text-success-800 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 justify-center select-none animate-pulse">
                        <Check className="w-4 h-4 shrink-0 text-success-600" />
                        <span>{successMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleCustomRegister} className="space-y-3">
                      <div>
                        <label className="text-micro uppercase font-bold text-neutral-400 block mb-1">Correo Electrónico (Email)</label>
                        <input
                          type="email"
                          required
                          placeholder="ejemplo@correo.com"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-700"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-micro uppercase font-bold text-neutral-400 block mb-1">Nombre</label>
                          <input
                            type="text"
                            required
                            placeholder="Pedro"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-700"
                          />
                        </div>
                        <div>
                          <label className="text-micro uppercase font-bold text-neutral-400 block mb-1">Apellido</label>
                          <input
                            type="text"
                            required
                            placeholder="Pérez"
                            value={newLastName}
                            onChange={(e) => setNewLastName(e.target.value)}
                            className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-700"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-micro uppercase font-bold text-neutral-400 block mb-1">Teléfono</label>
                        <input
                          type="text"
                          required
                          placeholder="+52 55 1212 3434"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-700"
                        />
                      </div>

                      <div>
                        <label className="text-micro uppercase font-bold text-neutral-400 block mb-1">Documento de Identidad (Cédula/Pasaporte)</label>
                        <input
                          type="text"
                          required
                          placeholder="PAS-102938"
                          value={newDoc}
                          onChange={(e) => setNewDoc(e.target.value)}
                          className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-700"
                        />
                      </div>

                      <div>
                        <label className="text-micro uppercase font-bold text-neutral-400 block mb-1">Define tu Contraseña</label>
                        <div className="relative">
                          <input
                            type={showRegisterPassword ? "text" : "password"}
                            required
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full text-xs border border-neutral-200 rounded-lg p-2.5 pl-10 pr-10 focus:outline-none focus:ring-1 focus:ring-neutral-700"
                          />
                          <KeyRound className="absolute left-3 top-3 w-4 h-4 text-neutral-400" />
                          <Button
                            type="button"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            variant="icon" className="absolute right-3 top-2.5"
                          >
                            {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="pt-2 flex gap-2">
                        <Button
                          type="button"
                          onClick={() => {
                            setCustomRegisterMode(false);
                            setIsGoogleAuthMode(false);
                          }}
                          variant="secondary" size="md" className="w-1/3"
                        >
                          Atrás
                        </Button>
                        <Button
                          type="submit"
                          disabled={loadingType === 'email'}
                          variant="primary" size="md" className="w-2/3"
                        >
                          {loadingType === 'email' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Registrando...</span>
                            </>
                          ) : (
                            <span>Completar Registro</span>
                          )}
                        </Button>
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
