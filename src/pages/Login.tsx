import { useAuth } from '../lib/auth';

export function Login() {
  const { signInWithGoogle, loading } = useAuth();

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0e1a]">
      {/* ── Animated mesh gradient background ─────────────────────────────── */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 mesh-bg" />
        <div className="absolute inset-0 dot-grid opacity-[0.07]" />
      </div>

      {/* ── Gradient orbs ─────────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-[500px] h-[500px] -top-32 -left-32 bg-blue-600/20 rounded-full blur-[120px] animate-orb1" />
        <div className="absolute w-[400px] h-[400px] top-1/4 -right-20 bg-indigo-500/20 rounded-full blur-[100px] animate-orb2" />
        <div className="absolute w-[350px] h-[350px] -bottom-20 left-1/4 bg-violet-500/15 rounded-full blur-[100px] animate-orb3" />
        <div className="absolute w-[300px] h-[300px] bottom-1/3 right-1/4 bg-cyan-500/10 rounded-full blur-[80px] animate-orb4" />
      </div>

      {/* ── Floating particles ────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/[0.04] animate-particle"
            style={{
              width: `${4 + (i % 3) * 3}px`,
              height: `${4 + (i % 3) * 3}px`,
              left: `${10 + i * 11}%`,
              bottom: `-${10 + (i % 4) * 5}px`,
              animationDelay: `${i * 1.5}s`,
              animationDuration: `${12 + (i % 3) * 4}s`,
            }}
          />
        ))}
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm animate-fadeInUp">
          {/* ── Glass card ──────────────────────────────────────────────── */}
          <div className="relative group">
            {/* Glow ring */}
            <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-br from-blue-400/30 via-transparent to-indigo-400/30 animate-shimmer opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

            <div className="relative backdrop-blur-2xl bg-white/[0.06] rounded-[28px] border border-white/[0.08] shadow-[0_8px_64px_rgba(0,0,0,0.4)] p-8 md:p-10">
              {/* Logo */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-xl animate-pulse-slow" />
                  <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl bg-white/[0.08] border border-white/[0.1] backdrop-blur-sm">
                    <img
                      src="/evita_logo.png"
                      alt="Evita Cabinets"
                      className="h-10 w-auto object-contain brightness-0 invert opacity-90"
                    />
                  </div>
                </div>
              </div>

              {/* Subtitle */}
              <p className="text-center text-[11px] font-medium tracking-[0.25em] uppercase text-white/40 mb-8">
                Millwork Quotation System
              </p>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />

              {/* Google sign-in button */}
              <button
                onClick={signInWithGoogle}
                disabled={loading}
                className="w-full relative group/btn flex items-center justify-center gap-3 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] hover:border-white/[0.2] text-white/80 hover:text-white font-medium py-3.5 px-5 rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm">Signing in...</span>
                  </div>
                ) : (
                  <>
                    <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span className="text-sm">Continue with Google</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-white/20 mt-8 tracking-wide">
            &copy; 2025 Evita Cabinets
          </p>
        </div>
      </div>

      {/* ── Animations ────────────────────────────────────────────────────── */}
      <style>{`
        .mesh-bg {
          background:
            radial-gradient(ellipse 80% 60% at 20% 40%, rgba(56,100,220,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 60% 80% at 80% 20%, rgba(99,60,200,0.10) 0%, transparent 70%),
            radial-gradient(ellipse 70% 50% at 50% 90%, rgba(30,80,180,0.08) 0%, transparent 70%);
          animation: meshShift 20s ease-in-out infinite alternate;
        }

        .dot-grid {
          background-image: radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px);
          background-size: 32px 32px;
        }

        @keyframes meshShift {
          0%   { filter: hue-rotate(0deg); transform: scale(1); }
          50%  { filter: hue-rotate(15deg); transform: scale(1.05); }
          100% { filter: hue-rotate(-10deg); transform: scale(1); }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.8; }
        }
        .animate-shimmer {
          animation: shimmer 4s ease-in-out infinite;
        }

        @keyframes particle {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(30px); opacity: 0; }
        }
        .animate-particle {
          animation: particle 16s linear infinite;
        }

        .animate-pulse-slow {
          animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(60px, 40px) scale(1.1); }
          66%      { transform: translate(-30px, -20px) scale(0.95); }
        }
        .animate-orb1 { animation: orb1 18s ease-in-out infinite; }

        @keyframes orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(-40px, 60px) scale(1.05); }
          66%      { transform: translate(20px, -40px) scale(0.9); }
        }
        .animate-orb2 { animation: orb2 22s ease-in-out infinite; }

        @keyframes orb3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(50px, -30px) scale(1.1); }
          66%      { transform: translate(-40px, 50px) scale(0.95); }
        }
        .animate-orb3 { animation: orb3 20s ease-in-out infinite; }

        @keyframes orb4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-30px, -40px) scale(1.08); }
        }
        .animate-orb4 { animation: orb4 15s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
