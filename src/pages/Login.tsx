import { useAuth } from '../lib/auth';

export function Login() {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/4 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl animate-blob" />
        <div className="absolute -top-1/4 -right-1/4 w-96 h-96 bg-slate-400/30 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-1/4 left-1/3 w-96 h-96 bg-blue-300/30 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/40 rounded-3xl shadow-2xl border border-white/50 p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/60 shadow-lg mb-4">
                <img
                  src="/evita_logo.png"
                  alt="Evita Cabinets"
                  className="h-14 w-auto object-contain"
                  style={{ filter: 'brightness(0) saturate(100%) invert(20%) sepia(80%) saturate(700%) hue-rotate(200deg)' }}
                />
              </div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">Evita Cabinets</h1>
              <p className="text-slate-600">Sistema de Cotizaciones</p>
            </div>

            <button
              onClick={signInWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white/70 hover:bg-white/90 backdrop-blur-sm border border-slate-200/50 text-slate-700 font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continuar con Google
                </>
              )}
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            Millwork Quotation System &copy; 2025
          </p>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
