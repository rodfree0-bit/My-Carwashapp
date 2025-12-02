import { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function EmailVerificationPrompt() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResendVerification = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const user = auth.currentUser;
      if (user) {
        await sendEmailVerification(user);
        setMessage('✅ Correo de verificación enviado. Por favor revisa tu bandeja de entrada.');
      }
    } catch (error: any) {
      setMessage('❌ Error al enviar el correo. Intenta nuevamente en unos minutos.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <h3 className="font-semibold text-yellow-800 mb-2">
        Verifica tu correo electrónico
      </h3>
      <p className="text-sm text-yellow-700 mb-3">
        Tu cuenta no está verificada. Por favor revisa tu correo electrónico.
      </p>
      
      {message && (
        <div className={`text-sm mb-3 ${message.includes('✅') ? 'text-green-700' : 'text-red-700'}`}>
          {message}
        </div>
      )}

      <button
        onClick={handleResendVerification}
        disabled={isLoading}
        className="text-sm bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Enviando...' : 'Reenviar correo de verificación'}
      </button>
    </div>
  );
}
