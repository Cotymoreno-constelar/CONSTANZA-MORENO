import React, { useState, useRef, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, Image as ImageIcon, Send, Sparkles, CheckCircle2, AlertCircle, RefreshCw, X, ArrowLeft, Download, Share2 } from 'lucide-react';
import { LiveWallService } from '../../services/liveWallService';
import { LiveEventConfig, LivePost } from '../../types/liveWall';
import { DivoLogo, getCustomLogoUrl } from '../brand/DivoLogo';

interface GuestUploadViewProps {
  slug?: string;
  defaultGuestName?: string;
  onGoBackToInvitation?: () => void;
  onOpenLiveWallScreen?: () => void;
}

export const GuestUploadView: React.FC<GuestUploadViewProps> = ({
  slug = 'divo20',
  defaultGuestName = '',
  onGoBackToInvitation,
  onOpenLiveWallScreen,
}) => {
  const [nombre, setNombre] = useState(defaultGuestName);
  const [mensaje, setMensaje] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedBase64, setCompressedBase64] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedPost, setSubmittedPost] = useState<LivePost | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [eventConfig, setEventConfig] = useState<LiveEventConfig>(LiveWallService.getEventConfig());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return LiveWallService.subscribeConfig((cfg) => setEventConfig(cfg));
  }, []);

  // Lógica de compresión de imagen en el navegador del celular según especificación técnica:
  // máx 1920px, calidad ~0.8, límite 10MB
  const handleProcessImage = async (file: File) => {
    setErrorMsg(null);

    // Límite de 10 MB antes de compresión
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('La foto supera el límite de 10 MB. Por favor elegí una foto más liviana.');
      return;
    }

    try {
      setIsCompressing(true);

      const options = {
        maxSizeMB: 1.5, // Reducir a ~1.5 MB para transmisión ágil y nítida
        maxWidthOrHeight: 1920, // Máx 1920px según requerimiento
        useWebWorker: true,
        initialQuality: 0.8, // Calidad 0.8 requerida
      };

      const compressedFile = await imageCompression(file, options);
      setSelectedFile(compressedFile);

      // Crear URL de previsualización
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        setPreviewUrl(base64Data);
        setCompressedBase64(base64Data);
        setIsCompressing(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      console.error('Error al comprimir imagen', err);
      // Fallback a leer el archivo original directamente
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
        setCompressedBase64(reader.result as string);
        setIsCompressing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessImage(file);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCompressedBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Generador de Historia para Instagram (formato vertical 1080x1920 con marco de lujo oficial DIVO 20 Años)
  const handleGenerateStory = async (post: LivePost) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fondo oscuro de lujo
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, 1080, 1920);

      // Marco dorado exterior
      ctx.strokeStyle = '#C5A059';
      ctx.lineWidth = 8;
      ctx.strokeRect(40, 40, 1000, 1840);

      // Marco dorado interior fino
      ctx.strokeStyle = 'rgba(197, 160, 89, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(55, 55, 970, 1810);

      // Cabecera institucional (usa logo real + "20 años" en dorado al lado)
      const customLogoUrl = getCustomLogoUrl();
      if (customLogoUrl) {
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            logoImg.onload = resolve;
            logoImg.onerror = reject;
            logoImg.src = customLogoUrl;
          });
          const maxLogoH = 95;
          const maxLogoW = 340;
          const logoScale = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height);
          const lw = logoImg.width * logoScale;
          const lh = logoImg.height * logoScale;
          const startX = 540 - (lw + 210) / 2;
          ctx.drawImage(logoImg, startX, 85 + (maxLogoH - lh) / 2, lw, lh);

          // Divisor vertical dorado
          ctx.fillStyle = 'rgba(197, 160, 89, 0.5)';
          ctx.fillRect(startX + lw + 28, 95, 2, 75);

          // "20 años" en dorado al lado
          ctx.fillStyle = '#C5A059';
          ctx.textAlign = 'left';
          ctx.font = 'bold 74px "Old Standard TT", Georgia, serif';
          ctx.fillText('20', startX + lw + 52, 155);
          ctx.font = 'italic 44px "Old Standard TT", Georgia, serif';
          ctx.fillText('años', startX + lw + 142, 155);

          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.font = '22px Montserrat, sans-serif';
          ctx.fillText('V I S T I E N D O   M O M E N T O S', 540, 210);
        } catch {
          ctx.fillStyle = '#C5A059';
          ctx.font = 'bold 34px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('D I V O   2 0   A Ñ O S', 540, 140);
        }
      } else {
        ctx.fillStyle = '#C5A059';
        ctx.font = 'bold 34px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('D I V O   2 0   A Ñ O S', 540, 140);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '24px Montserrat, sans-serif';
        ctx.fillText('V I S T I E N D O   M O M E N T O S', 540, 185);
      }
      ctx.textAlign = 'center';

      // Si tiene foto, dibujarla centrada
      if (post.imageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = post.imageUrl!;
        });

        // Contenedor para la foto
        const photoY = 240;
        const photoHeight = 1100;
        const photoWidth = 920;
        const photoX = (1080 - photoWidth) / 2;

        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(photoX, photoY, photoWidth, photoHeight);

        // Aspect ratio cover/fit
        const scale = Math.max(photoWidth / img.width, photoHeight / img.height);
        const nw = img.width * scale;
        const nh = img.height * scale;
        const ox = photoX + (photoWidth - nw) / 2;
        const oy = photoY + (photoHeight - nh) / 2;

        ctx.beginPath();
        ctx.rect(photoX, photoY, photoWidth, photoHeight);
        ctx.clip();
        ctx.drawImage(img, ox, oy, nw, nh);
        ctx.restore();

        // Borde dorado a la foto
        ctx.strokeStyle = '#C5A059';
        ctx.lineWidth = 4;
        ctx.strokeRect(photoX, photoY, photoWidth, photoHeight);

        // Mensaje y nombre abajo
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 44px Montserrat, sans-serif';
        ctx.fillText(post.nombreInvitado, 540, 1420);

        if (post.mensaje) {
          ctx.fillStyle = '#E7CF98';
          ctx.font = 'italic 34px "Old Standard TT", Georgia, serif';
          ctx.fillText(`"${post.mensaje.substring(0, 75)}"`, 540, 1480);
        }
      } else {
        // Solo texto tarjeta
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 50px Montserrat, sans-serif';
        ctx.fillText(post.nombreInvitado, 540, 800);

        ctx.fillStyle = '#E7CF98';
        ctx.font = 'italic 46px "Old Standard TT", Georgia, serif';
        ctx.fillText(`"${post.mensaje || 'Celebrando 20 años de elegancia'}"`, 540, 920);
      }

      // Pie de historia con fecha y hashtag
      ctx.fillStyle = '#C5A059';
      ctx.font = 'bold 28px Montserrat, sans-serif';
      ctx.fillText('22 DE OCTUBRE DE 2026 • CAPILLA BUEN PASTOR, CÓRDOBA', 540, 1720);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px Montserrat, sans-serif';
      ctx.fillText('#Divo20Años', 540, 1780);

      const storyDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const fileName = `Historia-Instagram-DIVO-20-Anos-${post.nombreInvitado.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;

      // Intentar compartir directo en móvil
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        try {
          const res = await fetch(storyDataUrl);
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: 'image/jpeg' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Historia DIVO 20 Años',
              text: '¡Celebrando los 20 Años de DIVO Trajes y Etiqueta! #Divo20Años',
            });
            return;
          }
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return;
        }
      }

      // Fallback a descarga
      const link = document.createElement('a');
      link.download = fileName;
      link.href = storyDataUrl;
      link.click();
    } catch (e) {
      console.error('Error generating Instagram story', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorMsg('Por favor poné tu nombre para que sepan quién sube la foto.');
      return;
    }
    if (!compressedBase64 && !mensaje.trim()) {
      setErrorMsg('Subí al menos una foto o escribí un mensaje para la pantalla.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const newPost = await LiveWallService.createPost({
        nombreInvitado: nombre.trim(),
        mensaje: mensaje.trim() || null,
        imageUrl: compressedBase64,
      });

      setSubmittedPost(newPost);
      // Limpiar formulario excepto el nombre
      setMensaje('');
      handleClearImage();
    } catch (err) {
      console.error('Error al publicar', err);
      setErrorMsg('Hubo un error al subir tu publicación. Intentá nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#FAF7F2] flex flex-col justify-between p-4 sm:p-6 selection:bg-[#C5A059] selection:text-black">
      {/* Top Header */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between py-3 border-b border-[#C5A059]/30">
        {onGoBackToInvitation ? (
          <button
            onClick={onGoBackToInvitation}
            className="flex items-center gap-1 text-xs text-[#C5A059] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a mi tarjeta</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></span>
            <span className="font-montserrat text-[10px] tracking-widest uppercase text-[#C5A059] font-bold">
              MURO EN VIVO • DIVO 20 AÑOS
            </span>
          </div>
        )}

        {onOpenLiveWallScreen && (
          <button
            onClick={onOpenLiveWallScreen}
            className="text-[10px] font-montserrat tracking-wider uppercase bg-[#C5A059]/20 hover:bg-[#C5A059] text-[#C5A059] hover:text-black px-2.5 py-1 transition-colors"
          >
            Ver pantalla gigante →
          </button>
        )}
      </header>

      {/* Main Upload Box */}
      <main className="w-full max-w-md mx-auto my-auto py-6">
        <div className="text-center mb-6">
          <DivoLogo size="sm" showSubtext={false} showTapeMeasure={false} />
          <h1 className="font-montserrat text-xl sm:text-2xl font-bold text-white mt-3">
            ¡Compartí tu momento en vivo!
          </h1>
          <p className="font-montserrat text-xs text-white/70 mt-1.5 leading-relaxed">
            Sacate una foto en la Capilla Buen Pastor o dejá tu mensaje. Tu foto saldrá al instante en la pantalla grande del escenario.
          </p>
        </div>

        {/* Success Alert */}
        {submittedPost && (
          <div className="mb-6 p-4 bg-emerald-950/70 border border-emerald-500/60 rounded-sm animate-fade-in">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-montserrat text-sm font-bold text-emerald-200">
                  {submittedPost.estado === 'pendiente'
                    ? '¡Tu publicación fue enviada a moderación!'
                    : '¡Genial! Tu foto ya está saliendo en la pantalla'}
                </h4>
                <p className="font-montserrat text-xs text-emerald-300/80 mt-1">
                  {submittedPost.estado === 'pendiente'
                    ? 'El staff la revisará en breve y aparecerá proyectada.'
                    : 'Mirá la pantalla gigante para verte proyectado/a junto a todos los invitados.'}
                </p>

                {/* Botón para generar Historia vertical para Instagram */}
                <div className="mt-3 pt-2.5 border-t border-emerald-500/30 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerateStory(submittedPost)}
                    className="py-1.5 px-3 bg-[#C5A059] hover:bg-[#E7CF98] text-black font-montserrat text-[11px] font-bold uppercase tracking-wider rounded-sm flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Descargar para Instagram Story (9:16)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubmittedPost(null)}
                    className="text-xs font-semibold text-emerald-300 underline hover:text-white px-2 py-1"
                  >
                    Subir otra foto o mensaje
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-3.5 bg-rose-950/70 border border-rose-500/60 rounded-sm flex items-center gap-2.5 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[#121212] border border-[#C5A059]/40 p-5 sm:p-6 shadow-2xl space-y-4">
          {/* Guest Name */}
          <div>
            <label className="block text-[11px] font-montserrat uppercase tracking-wider text-[#C5A059] font-bold mb-1.5">
              Tu Nombre y Apellido *
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Jimena Moreno / Juan Pérez"
              className="w-full bg-[#1b1b1b] border border-white/20 p-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#C5A059]"
            />
          </div>

          {/* Photo Upload Buttons */}
          <div>
            <label className="block text-[11px] font-montserrat uppercase tracking-wider text-[#C5A059] font-bold mb-1.5">
              Tu Foto para la Pantalla
            </label>

            {/* Hidden native inputs */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {!previewUrl ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-4 bg-gradient-to-br from-[#1e1e1e] to-[#151515] border border-[#C5A059]/50 hover:border-[#C5A059] flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer active:scale-95"
                >
                  <div className="w-10 h-10 rounded-full bg-[#C5A059]/20 flex items-center justify-center text-[#C5A059] group-hover:scale-110 transition-transform">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="font-montserrat text-xs font-bold text-white">
                    Sacar Foto
                  </span>
                  <span className="text-[9px] text-white/50">Abrir cámara</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 bg-gradient-to-br from-[#1e1e1e] to-[#151515] border border-white/15 hover:border-[#C5A059] flex flex-col items-center justify-center gap-2 group transition-all cursor-pointer active:scale-95"
                >
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="font-montserrat text-xs font-bold text-white">
                    Elegir de Galería
                  </span>
                  <span className="text-[9px] text-white/50">Fotos del celular</span>
                </button>
              </div>
            ) : (
              <div className="relative border-2 border-[#C5A059] bg-black p-2 rounded-sm">
                <img
                  src={previewUrl}
                  alt="Previsualización"
                  className="w-full max-h-72 object-contain mx-auto"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute top-3 right-3 p-1.5 bg-black/80 hover:bg-rose-600 text-white rounded-full transition-colors"
                  title="Quitar foto"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="mt-2 text-center text-[10px] text-white/60 font-mono">
                  {isCompressing ? 'Optimizando foto para la pantalla...' : '✓ Foto lista para proyección en alta calidad'}
                </div>
              </div>
            )}
          </div>

          {/* Optional Message */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-montserrat uppercase tracking-wider text-[#C5A059] font-bold">
                Mensaje o dedicatoria (Opcional)
              </label>
              <span className={`text-[10px] font-mono ${mensaje.length > 250 ? 'text-amber-400' : 'text-white/40'}`}>
                {mensaje.length}/280
              </span>
            </div>
            <textarea
              maxLength={280}
              rows={3}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="¡Felices 20 años DIVO! Gracias por vestir los momentos más especiales..."
              className="w-full bg-[#1b1b1b] border border-white/20 p-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#C5A059] resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isCompressing || isSubmitting}
            className="w-full py-3.5 px-4 bg-[#C5A059] hover:bg-[#E7CF98] text-black font-montserrat font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Enviando a la pantalla...</span>
              </>
            ) : isCompressing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Comprimiendo imagen...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>PUBLICAR EN LA PANTALLA</span>
              </>
            )}
          </button>
        </form>
      </main>

      {/* Footer info */}
      <footer className="w-full max-w-md mx-auto text-center text-[10px] text-white/40 font-montserrat py-3 border-t border-white/10">
        DIVO 20 Años • Vistiendo Momentos • Capilla Buen Pastor
      </footer>
    </div>
  );
};
