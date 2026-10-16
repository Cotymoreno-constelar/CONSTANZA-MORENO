import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, KeyRound, Sparkles } from 'lucide-react';
import { DivoLogo } from '../brand/DivoLogo';
import { AuthService } from '../../services/authService';

interface AdminLoginViewProps {
  onSuccess: () => void;
  onGoToGuestMode?: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  onSuccess,
  onGoToGuestMode,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = AuthService.login(password, rememberMe);
    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Clave incorrecta');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070707] text-[#FAF7F2] flex flex-col justify-between selection:bg-[#C5A059] selection:text-black relative overflow-hidden">
      {/* Background Decorative Ambience */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#C5A059]/20 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#8C6E38]/20 rounded-full blur-[140px]"></div>
      </div>

      {/* Top Subtle Bar */}
      <header className="relative z-10 border-b border-white/5 py-3 px-6 flex items-center justify-between text-xs text-white/40">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059]"></span>
          <span className="font-montserrat tracking-widest uppercase text-[10px] text-[#C5A059]">
            Área de Acceso Restringido
          </span>
        </div>
        <span className="font-montserrat text-[10px]">DIVO • 20 Años</span>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gradient-to-b from-[#141414] to-[#0c0c0c] border border-[#C5A059]/40 p-8 sm:p-10 shadow-2xl relative">
          {/* Top Gold Ornament Line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent"></div>

          {/* Logo & Header */}
          <div className="text-center mb-8">
            <DivoLogo size="md" showSubtext={false} showTapeMeasure={true} />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1a1710] border border-[#C5A059]/30 text-[#C5A059] text-[10px] font-montserrat tracking-[0.2em] uppercase font-bold mt-5">
              <Lock className="w-3 h-3 text-[#C5A059]" />
              <span>Panel de Administración</span>
            </div>
            <h2 className="font-montserrat text-xl sm:text-2xl font-black text-white uppercase tracking-wider mt-3">
              Ingreso Seguro
            </h2>
            <p className="font-montserrat text-xs text-white/60 mt-1.5">
              Introduce la clave autorizada para gestionar invitados, asistencia y automatizaciones.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-montserrat tracking-widest uppercase text-white/70 mb-2 font-semibold">
                Clave de Acceso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#C5A059]/70">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  autoFocus
                  placeholder="Introduce la clave del panel..."
                  className="w-full bg-[#181818] border border-white/20 focus:border-[#C5A059] text-white pl-10 pr-11 py-3 text-sm font-mono tracking-wider focus:outline-none transition-colors shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <div className="mt-2.5 p-2.5 bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-montserrat flex items-center gap-2">
                  <span className="text-sm font-bold">⚠</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Remember Me Toggle */}
            <div className="flex items-center justify-between text-xs font-montserrat pt-1">
              <label className="flex items-center gap-2 text-white/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-none accent-[#C5A059] bg-[#181818] border-white/20 cursor-pointer"
                />
                <span className="text-[11px]">Recordar sesión en este dispositivo</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !password.trim()}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#C5A059] via-[#d4af37] to-[#8C6E38] hover:from-[#d4af37] hover:to-[#9a783e] text-black font-montserrat text-xs tracking-widest uppercase font-black flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              <span>Acceder al Panel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Initial Help / Hint Box */}
          <div className="mt-7 pt-5 border-t border-white/10 text-center">
            <div className="bg-[#181611] border border-[#C5A059]/20 p-3 text-[11px] font-montserrat text-[#E7CF98]/90">
              <span className="font-bold text-[#C5A059] block mb-0.5">💡 Clave inicial predeterminada:</span>
              <span className="font-mono text-white font-bold bg-black/60 px-2 py-0.5 border border-[#C5A059]/40 inline-block tracking-widest text-xs">
                DIVO2026
              </span>
              <span className="block text-[10px] text-white/50 mt-1">
                (Podrás cambiarla por tu propia clave desde la barra superior del panel).
              </span>
            </div>

            {onGoToGuestMode && (
              <button
                type="button"
                onClick={onGoToGuestMode}
                className="mt-4 text-xs font-montserrat text-[#C5A059]/80 hover:text-[#C5A059] underline cursor-pointer transition-colors"
              >
                ¿Eres un invitado? Confirmar asistencia aquí →
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-4 px-4 text-center text-[10px] font-montserrat text-white/40">
        <span>DIVO Trajes y Etiqueta • 20 Años Vistiendo Momentos • Capilla Buen Pastor, Córdoba</span>
      </footer>
    </div>
  );
};
