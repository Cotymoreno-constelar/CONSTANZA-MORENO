import React, { useState } from 'react';
import { X, KeyRound, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { AuthService } from '../../services/authService';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast?: (msg: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.trim().length < 4) {
      setError('La nueva clave debe tener al menos 4 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva clave.');
      return;
    }

    const res = AuthService.changePassword(currentPassword, newPassword);
    if (res.success) {
      setSuccess('¡Clave actualizada correctamente!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onSuccessToast) {
        onSuccessToast('Clave de administración actualizada.');
      }
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
    } else {
      setError(res.error || 'Error al actualizar la clave');
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('¿Deseas restablecer la clave a la inicial predeterminada (DIVO2026)?')) {
      AuthService.resetToDefault();
      setSuccess('Clave restablecida a: DIVO2026');
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-[#C5A059] max-w-md w-full p-6 sm:p-7 relative shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white p-1 cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-5 border-b border-white/10 pb-4">
          <div className="w-8 h-8 rounded-full bg-[#C5A059]/20 border border-[#C5A059] flex items-center justify-center text-[#C5A059]">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-montserrat text-sm font-bold uppercase tracking-wider text-white">
              Seguridad del Panel
            </h3>
            <p className="font-montserrat text-[11px] text-[#C5A059]">
              Cambiar clave de acceso organizador
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-montserrat flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-montserrat flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-montserrat">
          {/* Current Password */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/70 mb-1 font-semibold">
              Clave Actual
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Ingresa la clave actual..."
                className="w-full bg-[#1a1a1a] border border-white/20 focus:border-[#C5A059] px-3 py-2 text-white pr-9 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[10px] text-white/40 block mt-1">
              (Si nunca la cambiaste, es DIVO2026)
            </span>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/70 mb-1 font-semibold">
              Nueva Clave
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Mínimo 4 caracteres..."
                className="w-full bg-[#1a1a1a] border border-white/20 focus:border-[#C5A059] px-3 py-2 text-white pr-9 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/40 hover:text-white"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/70 mb-1 font-semibold">
              Confirmar Nueva Clave
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Repite la nueva clave..."
              className="w-full bg-[#1a1a1a] border border-white/20 focus:border-[#C5A059] px-3 py-2 text-white focus:outline-none"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#C5A059] hover:bg-[#d4af37] text-black font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer"
            >
              Guardar Nueva Clave
            </button>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[10px] text-[#C5A059]/70 hover:text-[#C5A059] underline cursor-pointer"
              >
                Restablecer a DIVO2026
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-[10px] text-white/50 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
