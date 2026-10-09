import React, { useState, useEffect } from 'react';
import { generateQRDataUrl } from '../../utils/qrCardRenderer';
import {
  Maximize,
  Minimize,
  Sparkles,
  QrCode,
  LayoutGrid,
  Play,
  RotateCw,
  Clock,
  MessageSquare,
  Flame,
  Volume2,
  VolumeX,
  Camera
} from 'lucide-react';
import { LiveWallService } from '../../services/liveWallService';
import { LiveEventConfig, LivePost } from '../../types/liveWall';
import { DivoLogo } from '../brand/DivoLogo';

interface ProjectionScreenProps {
  slug?: string;
  onExit?: () => void;
}

export const ProjectionScreen: React.FC<ProjectionScreenProps> = ({
  slug = 'divo20',
  onExit,
}) => {
  const [posts, setPosts] = useState<LivePost[]>(LiveWallService.getPosts());
  const [eventConfig, setEventConfig] = useState<LiveEventConfig>(LiveWallService.getEventConfig());
  const [displayMode, setDisplayMode] = useState<'slideshow' | 'mosaic'>('slideshow');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Solo mostrar posts aprobados en la pantalla grande según requerimiento RLS
  const approvedPosts = posts.filter((p) => p.estado === 'aprobado');

  // URL para que los invitados escaneen desde la pantalla
  const guestUploadUrl = LiveWallService.getGuestUploadUrl(eventConfig.slug || slug);

  // Generar QR de escaneo para la esquina de la pantalla
  useEffect(() => {
    generateQRDataUrl(guestUploadUrl, 320, 1)
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error QR pantalla', err));
  }, [guestUploadUrl]);

  // Suscribirse a actualizaciones en tiempo real (Supabase / BroadcastChannel)
  useEffect(() => {
    const unsubPosts = LiveWallService.subscribePosts((newPosts) => {
      setPosts(newPosts);
    });

    const unsubConfig = LiveWallService.subscribeConfig((newCfg) => {
      setEventConfig(newCfg);
    });

    return () => {
      unsubPosts();
      unsubConfig();
    };
  }, []);

  // Temporizador para slideshow
  useEffect(() => {
    if (displayMode !== 'slideshow' || approvedPosts.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % approvedPosts.length);
    }, 6000); // 6 segundos por foto/tarjeta

    return () => clearInterval(interval);
  }, [displayMode, approvedPosts.length, isPaused]);

  // Manejo de pantalla completa
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const currentPost = approvedPosts[currentIndex] || null;

  return (
    <div
      onMouseMove={() => {
        setControlsVisible(true);
      }}
      onMouseLeave={() => setControlsVisible(false)}
      className="relative w-full h-screen min-h-[600px] bg-[#070707] text-[#FAF7F2] overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Subtle stage spotlight effect and ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(197,160,89,0.15)_0%,rgba(10,10,10,0.95)_75%)] pointer-events-none"></div>

      {/* Floating Header with Brand Logo & Title */}
      <header className="relative z-20 flex items-center justify-between p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <DivoLogo size="sm" showSubtext={false} showTapeMeasure={false} />
          <div className="border-l border-[#C5A059]/40 pl-4">
            <span className="font-montserrat text-[11px] sm:text-xs tracking-[0.35em] text-[#C5A059] uppercase font-bold block">
              MURO EN VIVO • 20 AÑOS
            </span>
            <span className="font-montserrat text-[9px] sm:text-[10px] text-white/60 tracking-wider">
              Capilla Paseo del Buen Pastor • Córdoba
            </span>
          </div>
        </div>

        {/* Live indicator badge */}
        <div className="flex items-center gap-2 bg-black/60 border border-[#C5A059]/40 px-3.5 py-1.5 rounded-full">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
          <span className="font-montserrat text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#E7CF98]">
            EN VIVO ({approvedPosts.length} publicaciones)
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-8">
        {approvedPosts.length === 0 ? (
          <div className="text-center max-w-lg p-8 bg-[#101010]/80 border border-[#C5A059]/30 rounded-sm">
            <DivoLogo size="md" showSubtext={true} />
            <h2 className="font-montserrat text-xl sm:text-2xl font-bold text-white mt-6">
              ¡Sé el primero en compartir tu foto!
            </h2>
            <p className="font-montserrat text-xs text-white/70 mt-2">
              Escaneá el código QR en la pantalla con la cámara de tu celular para subir tu recuerdo al instante.
            </p>
          </div>
        ) : displayMode === 'slideshow' && currentPost ? (
          <div
            key={currentPost.id}
            className="w-full max-w-5xl h-full max-h-[75vh] flex flex-col md:flex-row items-center justify-center gap-6 bg-[#0c0c0c]/90 border-2 border-[#C5A059]/60 shadow-[0_0_60px_rgba(197,160,89,0.15)] p-4 sm:p-8 rounded-sm animate-fade-in transition-all duration-700"
          >
            {/* If post has an image */}
            {currentPost.imageUrl ? (
              <div className="w-full md:w-3/5 h-full max-h-[60vh] flex items-center justify-center bg-black/60 overflow-hidden border border-white/10 rounded-sm">
                <img
                  src={currentPost.imageUrl}
                  alt={`Foto de ${currentPost.nombreInvitado}`}
                  className="max-h-[58vh] w-auto max-w-full object-contain rounded-sm shadow-2xl transition-transform duration-700 hover:scale-105"
                />
              </div>
            ) : null}

            {/* Post Details & Message (or full card if text-only) */}
            <div
              className={`flex flex-col justify-between ${
                currentPost.imageUrl ? 'w-full md:w-2/5' : 'w-full max-w-2xl py-8 px-6 text-center'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[#C5A059]"></span>
                  <span className="font-montserrat text-[10px] tracking-[0.25em] text-[#C5A059] uppercase font-bold">
                    INVITADO/A DIVO
                  </span>
                </div>

                <h3 className="font-montserrat text-2xl sm:text-3xl font-bold text-white tracking-wide">
                  {currentPost.nombreInvitado}
                </h3>

                {currentPost.mensaje && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-[#181510] to-[#111111] border-l-4 border-[#C5A059] rounded-sm">
                    <p className="font-old-standard italic text-lg sm:text-2xl text-[#E7CF98] leading-relaxed">
                      "{currentPost.mensaje}"
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/50">
                <span>DIVO 20 Años • Capilla Buen Pastor</span>
                <span>{new Date(currentPost.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</span>
              </div>
            </div>
          </div>
        ) : (
          /* Mosaic / Grid Mode */
          <div className="w-full max-w-6xl max-h-[75vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
            {approvedPosts.map((post) => (
              <div
                key={post.id}
                className="bg-[#121212] border border-[#C5A059]/40 rounded-sm overflow-hidden flex flex-col justify-between shadow-lg group hover:border-[#C5A059] transition-all"
              >
                {post.imageUrl ? (
                  <div className="aspect-square bg-black overflow-hidden relative">
                    <img
                      src={post.imageUrl}
                      alt={post.nombreInvitado}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/60 to-transparent p-2">
                      <span className="font-montserrat text-xs font-bold text-white block truncate">
                        {post.nombreInvitado}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-gradient-to-br from-[#1a1712] to-[#121212] flex-1 flex flex-col justify-between min-h-[160px]">
                    <p className="font-old-standard italic text-sm text-[#E7CF98]">
                      "{post.mensaje}"
                    </p>
                    <span className="font-montserrat text-[11px] font-bold text-white mt-2 block">
                      — {post.nombreInvitado}
                    </span>
                  </div>
                )}
                {post.mensaje && post.imageUrl && (
                  <div className="p-2.5 text-[11px] text-white/80 border-t border-white/10 truncate">
                    {post.mensaje}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* GOLDEN TICKER TAPE (Pasarela en Vivo con dedicatorias y menciones en movimiento continuo) */}
      <div className="relative z-20 bg-gradient-to-r from-[#181510] via-black to-[#181510] border-t border-b border-[#C5A059]/40 py-2 overflow-hidden flex items-center shadow-lg">
        <div className="px-3 bg-[#C5A059] text-black font-montserrat text-[9px] font-black tracking-widest uppercase shrink-0 z-10 flex items-center gap-1.5 shadow-md">
          <Sparkles className="w-3 h-3" />
          <span>DIVO 20 AÑOS</span>
        </div>

        <div className="overflow-hidden flex-1 relative">
          <div className="animate-marquee gap-8 items-center text-xs font-montserrat">
            {/* Duplicated list to create infinite seamless loop */}
            {[...approvedPosts, ...approvedPosts].map((p, idx) => (
              <span key={`${p.id}-${idx}`} className="inline-flex items-center gap-2 text-white/90">
                <span className="text-[#C5A059] font-bold">★ {p.nombreInvitado}:</span>
                <span className="text-white/80 italic font-old-standard text-sm">
                  "{p.mensaje || '¡Felices 20 años DIVO!'}"
                </span>
                <span className="text-white/20 mx-2">•</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* FIXED QR CODE IN BOTTOM CORNER (As specified) */}
      <div className="absolute bottom-12 right-6 z-30 flex items-center gap-3 bg-black/90 border-2 border-[#C5A059] p-3 rounded-sm shadow-2xl backdrop-blur-md">
        <div className="flex flex-col text-right">
          <span className="font-montserrat text-[9px] tracking-[0.2em] text-[#C5A059] uppercase font-bold">
            ESCANEA EL QR
          </span>
          <span className="font-montserrat text-xs font-extrabold text-white">
            SUBÍ TU FOTO
          </span>
          <span className="font-mono text-[8px] text-white/60">
            Aparece en pantalla
          </span>
        </div>

        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR para subir fotos"
            className="w-20 h-20 sm:w-24 sm:h-24 bg-white p-1 rounded-sm block"
          />
        ) : (
          <div className="w-20 h-20 bg-neutral-800 animate-pulse rounded-sm"></div>
        )}
      </div>

      {/* DISCREET BOTTOM CONTROLS (Fade in on mouse hover) */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#161616]/95 border border-[#C5A059]/50 rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl backdrop-blur-md transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={() => setDisplayMode(displayMode === 'slideshow' ? 'mosaic' : 'slideshow')}
          className="text-xs font-montserrat tracking-wider uppercase text-white/80 hover:text-[#C5A059] flex items-center gap-1.5 px-2 py-1"
        >
          {displayMode === 'slideshow' ? (
            <>
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Ver Mosaico</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Ver Diapositivas</span>
            </>
          )}
        </button>

        <div className="w-[1px] h-4 bg-white/20"></div>

        {displayMode === 'slideshow' && (
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="text-xs font-montserrat text-white/80 hover:text-[#C5A059] px-2 py-1"
          >
            {isPaused ? 'Reanudar' : 'Pausar'}
          </button>
        )}

        <button
          onClick={toggleFullscreen}
          className="text-xs font-montserrat text-white/80 hover:text-[#C5A059] p-1.5"
          title="Pantalla Completa"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>

        {onExit && (
          <button
            onClick={onExit}
            className="text-xs font-montserrat text-rose-400 hover:text-rose-300 px-2 py-1"
          >
            Salir
          </button>
        )}
      </div>
    </div>
  );
};
