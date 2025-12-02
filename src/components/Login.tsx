import { useState, useRef, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  getIdTokenResult,
  createUserWithEmailAndPassword,
  updateProfile,
  linkWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { LOGO_URL } from '../assets/logo';
import { useRouter } from 'next/router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');  // FIX: Removido corchete extra
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('+1');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyMethod, setVerifyMethod] = useState<'email' | 'phone'>('email');
  // Añadidos: tipo de cuenta y clave de owner
  const [accountType, setAccountType] = useState<'customer' | 'owner'>('customer');
  const [ownerKey, setOwnerKey] = useState('');
  const [otp, setOtp] = useState('');
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  // NUEVO: espera de verificación por email y rol registrado
  const [awaitingEmailVerification, setAwaitingEmailVerification] = useState(false);
  const [registeredRole, setRegisteredRole] = useState<'customer'|'owner'>('customer');
  const [fbStatus, setFbStatus] = useState<'pending' | 'ok' | 'error'>('pending');
  const [fbMsg, setFbMsg] = useState('');

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const router = useRouter();

  // Inicializa reCAPTCHA invisible si no existe (solo en cliente)
  // ReCAPTCHA: inicializar solo en cliente
  const ensureRecaptcha = () => {
    if (typeof window === 'undefined') return null;
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      return recaptchaRef.current;
    } catch (err) {
      console.error('reCAPTCHA init error:', err);
      return null;
    }
  };

  // Verifica conectividad a Firestore (lectura simple)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await getDoc(doc(db, '_meta', 'ping')); // si no existe, igual prueba la conexión
        if (!mounted) return;
        setFbStatus('ok');
        setFbMsg('Conectado a Firestore');
      } catch (e: any) {
        if (!mounted) return;
        setFbStatus('error');
        setFbMsg(e?.code || 'Error de conexión o reglas');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Owner Key (configurable por ENV con bypass opcional en desarrollo)
  const OWNER_KEY = process.env.NEXT_PUBLIC_OWNER_KEY || 'OWNER-2024';
  const ALLOW_OWNER_BYPASS = (process.env.NEXT_PUBLIC_ALLOW_OWNER_BYPASS === 'true');

  // REGISTRO con verificación por email o teléfono
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // En handleRegisterSubmit: evita doble envío y valida reCAPTCHA antes de SMS
    if (isLoading) return;
    setError('');
    setIsLoading(true);

    try {
      console.log('🔵 Iniciando registro...');

      // Validaciones mínimas
      if (!firstName.trim() || !lastName.trim() || !address.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
        setError('Completa todos los campos de dirección');
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden');
        setIsLoading(false);
        return;
      }
      
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres');
        setIsLoading(false);
        return;
      }

      // VALIDAR OWNER KEY si elige cuenta de dueño
      if (accountType === 'owner') {
        if (!ownerKey.trim()) {
          setError('Ingresa la clave de propietario');
          setIsLoading(false);
          return;
        }
        if (ownerKey.trim() !== OWNER_KEY && !ALLOW_OWNER_BYPASS) {
          setError('Clave de propietario inválida');
          setIsLoading(false);
          return;
        }
      }

      const emailSanitized = email.trim().toLowerCase();
      console.log('🔵 Email:', emailSanitized);

      // Crear usuario con email/password
      console.log('🔵 Creando usuario en Firebase Auth...');
      const cred = await createUserWithEmailAndPassword(auth, emailSanitized, password);
      console.log('✅ Usuario creado:', cred.user.uid);
      
      await updateProfile(cred.user, { displayName: `${firstName.trim()} ${lastName.trim()}` });
      console.log('✅ Perfil actualizado');

      // Guardar datos en Firestore con el rol elegido
      console.log('🔵 Guardando en Firestore...');
      try {
        await setDoc(doc(db, 'users', cred.user.uid), {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          zipCode: zipCode.trim(),
          phone: phone.trim(),
          email: emailSanitized,
          role: accountType,
          phoneVerified: false,
          createdAt: serverTimestamp()
        }, { merge: true });
        console.log('✅ Datos guardados en Firestore');
      } catch (wErr: any) {
        console.error('❌ Firestore setDoc error:', wErr);
        if (wErr?.code === 'permission-denied') {
          setError('No tienes permisos para escribir en Firestore. Revisa las reglas.');
        } else if (wErr?.code === 'unavailable' || wErr?.message?.includes('offline')) {
          setError('Firestore sin conexión. Revisa internet o reglas.');
        } else {
          setError('Error guardando perfil en Firestore. ' + (wErr?.message || 'Intenta nuevamente'));
        }
        setIsLoading(false);
        // Cerrar sesión del usuario recién creado para evitar estado intermedio
        try { await signOut(auth); } catch {}
        return;
      }

      if (verifyMethod === 'email') {
        // Verificación por email: NO cerrar sesión; guiar a verificación
        try {
          await sendEmailVerification(cred.user);
        } catch (emailErr) {
          console.error('⚠️ Error enviando correo:', emailErr);
        }
        setAwaitingEmailVerification(true); // NUEVO
        setError(`Te enviamos un correo de verificación a ${emailSanitized}. Abre el enlace y luego presiona "Verificar ahora".`);
        return; // salir sin cambiar de modo
      } else {
        // Verificación por teléfono con OTP
        const cleanPhone = phone.replace(/\D/g, '');
        const raw = '+' + cleanPhone;

        // ...existing code validaciones...

        const appVerifier = ensureRecaptcha();
        if (!appVerifier) {
          setError('No se pudo inicializar reCAPTCHA. Recarga la página e intenta nuevamente.');
          await signOut(auth);
          setIsLoading(false);
          return;
        }
        try {
          const confirmation = await linkWithPhoneNumber(cred.user, raw, appVerifier);
          confirmationRef.current = confirmation;
          setAwaitingOtp(true);
          setError('✅ Te enviamos un SMS con el código. Ingresa el código para verificar tu teléfono.');
        } catch (smsErr: any) {
          console.error('SMS send error:', smsErr);
          setError('No se pudo enviar el SMS. Verifica tu número (+1...) y vuelve a intentar.');
          await signOut(auth);
        }
      }
    } catch (err: any) {
      console.error('❌ Error de registro completo:', err);
      console.error('Código:', err?.code);
      console.error('Mensaje:', err?.message);
      
      switch (err?.code) {
        case 'auth/email-already-in-use':
          setError('Este correo ya está registrado. Intenta iniciar sesión.');
          break;
        case 'auth/invalid-email':
          setError('Correo electrónico inválido');
          break;
        case 'auth/weak-password':
          setError('La contraseña debe tener al menos 6 caracteres');
          break;
        case 'auth/too-many-requests':
          setError('Demasiados intentos. Intenta más tarde.');
          break;
        case 'auth/network-request-failed':
          setError('Error de conexión. Verifica tu internet.');
          break;
        default:
          setError('Error: ' + (err?.message || 'Intenta nuevamente'));
      }
    } finally {
      setIsLoading(false);
      console.log('🔵 Proceso finalizado');
    }
  };

  // Confirmar OTP de teléfono (registro)
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationRef.current) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await confirmationRef.current.confirm(otp);
      // Marcar teléfono verificado
      const current = result.user || auth.currentUser;
      if (current) {
        await setDoc(doc(db, 'users', current.uid), { phoneVerified: true }, { merge: true });
      }
      // NUEVO: redirigir directo según rol
      await finalizeAfterVerification(current?.uid);
      setAwaitingOtp(false);
      setOtp('');
    } catch (err: any) {
      console.error('OTP error:', err);
      setError('Código inválido o expirado. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // NUEVO: finalizar flujo tras verificar (email o teléfono)
  const finalizeAfterVerification = async (uid?: string) => {
    try {
      const user = auth.currentUser;
      const finalUid = uid || user?.uid;
      let role: string = 'customer';
      if (finalUid) {
        try {
          const snap = await getDoc(doc(db, 'users', finalUid));
          if (snap.exists()) {
            const d = snap.data() as any;
            if (typeof d?.role === 'string') role = d.role;
          }
        } catch {}
      } else {
        role = registeredRole;
      }
      switch (role) {
        case 'owner':
          await router.push('/owner');
          break;
        case 'admin':
          await router.push('/admin/orders');
          break;
        case 'worker':
        case 'washer':
          await router.push('/washer/orders');
          break;
        default:
          await router.push('/customer-dashboard');
      }
    } catch (e) {
      setError('No se pudo continuar. Inicia sesión nuevamente.');
      setMode('login');
    }
  };

  // NUEVO: botón “Verificar ahora” (email)
  const handleCheckEmailVerified = async () => {
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        await finalizeAfterVerification();
      } else {
        setError('Aún no verificas tu correo. Revisa bandeja o spam.');
      }
    } catch {
      setError('No se pudo verificar el estado. Intenta de nuevo.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);

    try {
      console.log('🔵 Iniciando login...');
      const emailSanitized = email.trim().toLowerCase();
      
      const userCredential = await signInWithEmailAndPassword(auth, emailSanitized, password);
      console.log('✅ Login exitoso, UID:', userCredential.user.uid);

      // FORZAR lectura de Firestore
      let userRole: string = 'customer';
      try {
        console.log('🔵 Intentando leer rol desde Firestore...');
        const profileSnap = await getDoc(doc(db, 'users', userCredential.user.uid));
        console.log('📄 Snapshot exists:', profileSnap.exists());
        if (profileSnap.exists()) {
          const d = profileSnap.data() as any;
          console.log('📄 Data:', d);
          userRole = d?.role || 'customer';
          console.log('✅ Rol obtenido:', userRole);
        } else {
          console.log('⚠️ Documento de usuario no existe en Firestore');
        }
      } catch (firestoreErr: any) {
        console.error('❌ Error leyendo Firestore:', firestoreErr);
        console.error('Código:', firestoreErr?.code);
        console.error('Mensaje:', firestoreErr?.message);
        // Si falla por reglas, informar
        if (firestoreErr?.code === 'permission-denied') {
          setError('Error: Firestore bloqueado por reglas. Actualiza las reglas de seguridad.');
          setIsLoading(false);
          return;
        }
      }

      console.log('🔵 Redirigiendo según rol:', userRole);
      // Redirigir según el rol
      switch (userRole) {
        case 'owner':
          await router.push('/owner');
          break;
        case 'admin':
          await router.push('/admin/orders');
          break;
        case 'worker':
        case 'washer':
          await router.push('/washer/orders');
          break;
        case 'customer':
        default:
          await router.push('/customer-dashboard');
          break;
      }
    } catch (err: any) {
      console.error('❌ Error de login completo:', err);
      console.error('Código:', err?.code);
      console.error('Mensaje:', err?.message);
      
      switch (err?.code) {
        case 'auth/user-not-found':
          setError('No existe una cuenta con este correo.');
          break;
        case 'auth/wrong-password':
          setError('Contraseña incorrecta.');
          break;
        case 'auth/invalid-credential':
          setError('Correo o contraseña incorrectos.');
          break;
        case 'auth/invalid-email':
          setError('Correo electrónico inválido');
          break;
        case 'auth/user-disabled':
          setError('Esta cuenta ha sido deshabilitada');
          break;
        case 'auth/network-request-failed':
          setError('Error de conexión. Verifica tu internet');
          break;
        case 'auth/too-many-requests':
          setError('Demasiados intentos fallidos. Espera un momento.');
          break;
        default:
          setError('Error: ' + (err?.message || 'Intenta nuevamente'));
      }
    } finally {
      setIsLoading(false);
      console.log('🔵 Login proceso finalizado');
    }
  };

  // Reenviar verificación manualmente
  const handleResendVerification = async () => {
    if (!email || !password) return;
    setIsLoading(true);
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await sendEmailVerification(cred.user);
      await signOut(auth);
      setError('Correo de verificación reenviado. Revisa tu bandeja de entrada o spam.');
    } catch {
      setError('No se pudo reenviar el correo de verificación. Intenta más tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
        {/* reCAPTCHA invisible */}
        <div id="recaptcha-container" />
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src={LOGO_URL}
            alt="Car Wash Logo"
            className="h-16 w-auto mx-auto mb-4"
            onError={(e) => { e.currentTarget.src = "https://via.placeholder.com/150?text=Logo"; }}
          />
          <h2 className="text-3xl font-bold text-white">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>
          <p className="text-slate-400 mt-2">
            {mode === 'login' ? 'Accede a tu cuenta Car Wash' : 'Regístrate para empezar a usar nuestros servicios.'}
          </p>
        </div>

        {/* Selector de modo - sin tabs */}
        <div className="mb-6" />

        {/* Mensajes */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
            {/* Reenviar verificación email en login */}
            {mode === 'login' && error.toLowerCase().includes('verific') && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={isLoading}
                  className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Reenviar verificación por email
                </button>
              </div>
            )}
          </div>
        )}

        {/* Formulario LOGIN */}
        {mode === 'login' && !awaitingEmailVerification && !awaitingOtp && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-slate-400"
                required
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-slate-400"
                required
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 font-semibold text-base hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
            <div className="text-center mt-4">
              <p className="text-sm text-slate-400">
                ¿No tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-blue-400 hover:text-blue-300 font-semibold hover:underline"
                >
                  Regístrate aquí
                </button>
              </p>
            </div>
          </form>
        )}

        {/* Formulario REGISTRO */}
        {mode === 'register' && !awaitingOtp && !awaitingEmailVerification && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nombre</label>
                <input
                  type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Apellido</label>
                <input
                  type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Dirección (Calle y número)</label>
              <input
                type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" 
                required
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Ciudad</label>
                <input
                  type="text" value={city} onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" 
                  required
                  placeholder="New York"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Estado</label>
                <input
                  type="text" value={state} onChange={(e) => setState(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" 
                  required
                  placeholder="NY"
                  maxLength={2}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Código Postal</label>
              <input
                type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" 
                required
                placeholder="10001"
                maxLength={5}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Teléfono</label>
              <input
                type="tel" 
                value={phone} 
                onChange={(e) => {
                  let val = e.target.value;
                  
                  // Si el usuario borra todo, volver a +1
                  if (val.length === 0 || val === '+' || val === '+1') {
                    setPhone('+1');
                    return;
                  }
                  
                  // Remover todo excepto números
                  const numbersOnly = val.replace(/\D/g, '');
                  
                  // Si no hay números después del 1, mantener solo +1
                  if (numbersOnly.length <= 1) {
                    setPhone('+1');
                    return;
                  }
                  
                  // Extraer solo los dígitos después del código de país (1)
                  const phoneDigits = numbersOnly.slice(1);
                  
                  // Limitar a 10 dígitos
                  const limitedDigits = phoneDigits.slice(0, 10);
                  
                  // Formatear: +1 (XXX) XXX-XXXX
                  let formatted = '+1';
                  
                  if (limitedDigits.length > 0) {
                    formatted += ' (';
                    formatted += limitedDigits.slice(0, 3);
                    
                    if (limitedDigits.length > 3) {
                      formatted += ') ';
                      formatted += limitedDigits.slice(3, 6);
                      
                      if (limitedDigits.length > 6) {
                        formatted += '-';
                        formatted += limitedDigits.slice(6, 10);
                      }
                    }
                  }
                  
                  setPhone(formatted);
                }}
                onKeyDown={(e) => {
                  // Permitir retroceso incluso cuando está en +1
                  if (e.key === 'Backspace' && phone === '+1') {
                    e.preventDefault();
                  }
                }}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" 
                required
                placeholder="+1 (234) 567-8900"
              />
              <p className="text-xs text-slate-400 mt-1">Formato: +1 (XXX) XXX-XXXX. Debe iniciar con +1.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Correo Electrónico</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" required minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Confirmar contraseña</label>
                <input
                  type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" required minLength={6}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Método de verificación</label>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-slate-300">
                  <input type="radio" name="verifyMethod" value="email" checked={verifyMethod === 'email'} onChange={() => setVerifyMethod('email')} className="text-blue-600" />
                  <span>Email</span>
                </label>
                <label className="inline-flex items-center gap-2 text-slate-300">
                  <input type="radio" name="verifyMethod" value="phone" checked={verifyMethod === 'phone'} onChange={() => setVerifyMethod('phone')} className="text-blue-600" />
                  <span>Teléfono (SMS)</span>
                </label>
              </div>
            </div>

            {/* Tipo de cuenta */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de cuenta</label>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-slate-300">
                  <input
                    type="radio"
                    name="accountType"
                    value="customer"
                    checked={accountType === 'customer'}
                    onChange={() => setAccountType('customer')}
                    className="text-blue-600"
                  />
                  <span>Cliente</span>
                </label>
                <label className="inline-flex items-center gap-2 text-slate-300">
                  <input
                    type="radio"
                    name="accountType"
                    value="owner"
                    checked={accountType === 'owner'}
                    onChange={() => setAccountType('owner')}
                    className="text-blue-600"
                  />
                  <span>Owner</span>
                </label>
              </div>
            </div>

            {/* Owner Key solo si es owner */}
            {accountType === 'owner' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Clave de Propietario</label>
                <input
                  type="password"
                  value={ownerKey}
                  onChange={(e) => setOwnerKey(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400"
                  placeholder="Ingresa la clave proporcionada"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Requerida para crear cuentas Owner.
                  {process.env.NEXT_PUBLIC_ALLOW_OWNER_BYPASS === 'true' ? ' (DEV: bypass activo)' : ''}
                </p>
                {/* Pista opcional en dev */}
                {process.env.NODE_ENV !== 'production' && (
                  <p className="text-[11px] text-slate-500 mt-1">Clave por defecto: OWNER-2024</p>
                )}
              </div>
            )}

            <button
              type="submit" disabled={isLoading}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 font-semibold text-base hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>

            <div className="text-center mt-4">
              <p className="text-sm text-slate-400">
                ¿Ya tienes una cuenta?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-blue-400 hover:text-blue-300 font-semibold hover:underline">
                  Inicia Sesión
                </button>
              </p>
            </div>
          </form>
        )}

        {/* Paso de OTP */}
        {mode === 'register' && awaitingOtp && !awaitingEmailVerification && (
          <form onSubmit={handleConfirmOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Código de verificación (SMS)</label>
              <input
                type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400"
                required placeholder="Ingresa el código recibido"
              />
            </div>
            <button
              type="submit" disabled={isLoading}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 font-semibold text-base hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Verificando...' : 'Confirmar código'}
            </button>
          </form>
        )}

        {/* NUEVO: Espera de verificación por Email */}
        {awaitingEmailVerification && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white">Verifica tu correo</h3>
            <p className="text-slate-300 text-sm">
              Abre el enlace que te enviamos por email. Luego presiona el botón de abajo.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCheckEmailVerified}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                Verificar ahora
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
                    setError('Correo reenviado. Revisa bandeja y spam.');
                  } catch {
                    setError('No se pudo reenviar. Intenta más tarde.');
                  }
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Reenviar correo
              </button>
            </div>
            <button
              type="button"
              onClick={async () => { await signOut(auth); setAwaitingEmailVerification(false); setMode('login'); }}
              className="text-slate-400 text-xs underline"
            >
              Salir y volver al login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}