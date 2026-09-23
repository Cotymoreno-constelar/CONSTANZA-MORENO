import React, { useEffect, useState, useRef } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCcw,
  Search,
  Volume2,
  VolumeX,
  UserCheck,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  Upload,
  RefreshCw,
  FileImage,
  KeyRound,
  ExternalLink,
  Zap,
  Power
} from 'lucide-react';
import { Guest } from '../../types/guest';
import { GuestService, calculateStats } from '../../services/guestService';

interface DoorScannerProps {
  guests: Guest[];
  onGuestUpdated?: (updated: Guest) => void;
}

export const DoorScanner: React.FC<DoorScannerProps> = ({
  guests,
  onGuestUpdated,
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermissionState, setCameraPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Active scan result state
  const [scannedGuest, setScannedGuest] = useState<Guest | null>(null);
  const [scanResultType, setScanResultType] = useState<'valid' | 'already-entered' | 'not-confirmed' | 'not-found' | null>(null);
  const [alreadyCheckedInTime, setAlreadyCheckedInTime] = useState<string | null>(null);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [staffName, setStaffName] = useState('Acceso Principal - Capilla Buen Pastor');

  // Modes: live camera, take photo / upload file, manual code, guest search list
  const [activeMode, setActiveMode] = useState<'camera' | 'photo' | 'code' | 'search'>('camera');
  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFileAnalyzing, setIsFileAnalyzing] = useState(false);
  const [fileScanError, setFileScanError] = useState<string | null>(null);

  // Detect if running inside iframe
  const [isEmbeddedIframe, setIsEmbeddedIframe] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stats = calculateStats(guests);

  useEffect(() => {
    try {
      setIsEmbeddedIframe(window.self !== window.top);
    } catch {
      setIsEmbeddedIframe(true);
    }
  }, []);

  // Web Audio Synth for crisp sound cues
  const playSound = (type: 'success' | 'alert' | 'error') => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        const now = ctx.currentTime;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'alert') {
        const now = ctx.currentTime;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.setValueAtTime(0.01, now + 0.12);
        gain.gain.setValueAtTime(0.4, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.31);
      } else {
        const now = ctx.currentTime;
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.26);
      }
    } catch {
      // Audio not supported or blocked
    }
  };

  // Stop video stream and scan loop
  const stopCameraStream = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Start video stream
  const startCameraStream = async (requestedFacing?: 'environment' | 'user') => {
    stopCameraStream();
    setIsInitializing(true);
    setCameraError(null);

    const mode = requestedFacing || facingMode;

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraPermissionState('unsupported');
      setCameraError(
        'Este navegador o visor no permite acceso directo a la cámara por video stream. Utiliza la opción "Tomar Foto / Archivo" o "Ingreso por Código".'
      );
      setIsInitializing(false);
      return;
    }

    try {
      let stream: MediaStream | null = null;

      // Strategy 1: Try requested facing mode (ideal)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Strategy 1 failed, trying fallback to any video...', err1);
        // Strategy 2: Fallback to basic video without constraints (e.g. laptop webcam)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (err2) {
          throw err2;
        }
      }

      if (!stream) {
        throw new Error('No se pudo obtener el flujo de video.');
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      setCameraPermissionState('granted');
      setCameraError(null);

      // Start scanning loop
      requestScanFrame();
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraPermissionState('denied');
      let msg = 'No se pudo acceder a la cámara.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permiso denegado por el navegador o restringido en el visor actual.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No se encontró ninguna cámara conectada en este dispositivo.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'La cámara está siendo utilizada por otra aplicación o pestaña.';
      }

      setCameraError(msg);
      setIsCameraActive(false);
    } finally {
      setIsInitializing(false);
    }
  };

  // Continuous frame analysis
  const requestScanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleQrCodeDecoded(code.data);
          // Pause brief moment to avoid rapid multiple triggers
          setTimeout(() => {
            animationFrameId.current = requestAnimationFrame(tick);
          }, 1200);
          return;
        }
      }

      animationFrameId.current = requestAnimationFrame(tick);
    };

    animationFrameId.current = requestAnimationFrame(tick);
  };

  // Cleanup on unmount or mode switch
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const toggleCameraFacing = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (isCameraActive) {
      await startCameraStream(next);
    }
  };

  // Decode QR and identify guest
  const handleQrCodeDecoded = (decodedText: string) => {
    let targetToken = decodedText.trim();
    try {
      if (decodedText.includes('guest=')) {
        const url = new URL(decodedText);
        const param = url.searchParams.get('guest');
        if (param) targetToken = param;
      } else if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        const parts = decodedText.split('/');
        targetToken = parts[parts.length - 1];
      }
    } catch {
      // fallback
    }

    processGuestInspection(targetToken);
  };

  // Inspect guest by token, ID or full name
  const processGuestInspection = (tokenOrId: string) => {
    const cleanQuery = tokenOrId.trim().toLowerCase();
    if (!cleanQuery) return;

    const match = guests.find(
      (g) =>
        g.token.toLowerCase() === cleanQuery ||
        g.id.toLowerCase() === cleanQuery ||
        `${g.firstName} ${g.lastName}`.toLowerCase() === cleanQuery
    );

    if (!match) {
      setScanResultType('not-found');
      setScannedGuest(null);
      playSound('error');
      return;
    }

    setScannedGuest(match);

    if (match.checkedIn) {
      setScanResultType('already-entered');
      setAlreadyCheckedInTime(match.checkedInAt || null);
      playSound('alert');
    } else if (match.status !== 'confirmed') {
      setScanResultType('not-confirmed');
      playSound('alert');
    } else {
      setScanResultType('valid');
      playSound('success');
    }
  };

  // Process uploaded image file or camera capture
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileAnalyzing(true);
    setFileScanError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('No se pudo inicializar canvas para decodificar.');
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code && code.data) {
            handleQrCodeDecoded(code.data);
            setFileScanError(null);
          } else {
            setFileScanError('No se encontró un código QR legible en esta foto. Intenta enfocar más de cerca o usa el código manual.');
            playSound('error');
          }
        } catch (err: any) {
          console.error('File QR decode error:', err);
          setFileScanError('Error al procesar la imagen seleccionada.');
        } finally {
          setIsFileAnalyzing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      img.onerror = () => {
        setFileScanError('El archivo seleccionado no es una imagen válida.');
        setIsFileAnalyzing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Admission actions
  const handleConfirmAdmission = async (forceAdmit = false) => {
    if (!scannedGuest) return;
    setIsSubmittingCheckIn(true);
    try {
      const result = await GuestService.registerCheckIn(scannedGuest.id, staffName, forceAdmit);
      setScannedGuest(result.guest);
      if (onGuestUpdated) {
        onGuestUpdated(result.guest);
      }

      if (result.alreadyCheckedIn && !forceAdmit) {
        setScanResultType('already-entered');
        setAlreadyCheckedInTime(result.previousTime || null);
        playSound('alert');
      } else {
        setScanResultType('valid');
        playSound('success');
      }
    } catch (err) {
      console.error('Error admitting guest', err);
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const handleUndoAdmission = async () => {
    if (!scannedGuest) return;
    setIsSubmittingCheckIn(true);
    try {
      const undone = await GuestService.undoCheckIn(scannedGuest.id);
      setScannedGuest(undone);
      setScanResultType('valid');
      if (onGuestUpdated) {
        onGuestUpdated(undone);
      }
    } catch (err) {
      console.error('Error undoing admission', err);
    } finally {
      setIsSubmittingCheckIn(false);
    }
  };

  const clearScan = () => {
    setScannedGuest(null);
    setScanResultType(null);
    setAlreadyCheckedInTime(null);
  };

  const filteredSearchGuests = searchQuery.trim()
    ? guests.filter((g) => {
        const full = `${g.firstName} ${g.lastName} ${g.token} ${g.email || ''}`.toLowerCase();
        return full.includes(searchQuery.toLowerCase());
      })
    : [];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 text-[#FAF7F2]">
      {/* Live Entrance Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        <div className="bg-[#141414] border border-[#C5A059]/30 p-3 text-center">
          <div className="text-[9px] font-montserrat tracking-widest text-[#C5A059] uppercase font-semibold">
            Ingresados en Sala
          </div>
          <div className="text-2xl sm:text-3xl font-montserrat font-bold text-white mt-0.5">
            {stats.checkedInGuests}
          </div>
          <div className="text-[10px] text-white/50 font-mono">
            {stats.totalCheckedInPeople} personas ingresadas
          </div>
        </div>

        <div className="bg-[#141414] border border-emerald-500/30 p-3 text-center">
          <div className="text-[9px] font-montserrat tracking-widest text-emerald-400 uppercase font-semibold">
            Confirmados
          </div>
          <div className="text-2xl sm:text-3xl font-montserrat font-bold text-emerald-400 mt-0.5">
            {stats.confirmedGuests}
          </div>
          <div className="text-[10px] text-white/50 font-mono">
            {stats.totalAttendingPeople} esperadas
          </div>
        </div>

        <div className="bg-[#141414] border border-amber-500/30 p-3 text-center">
          <div className="text-[9px] font-montserrat tracking-widest text-amber-400 uppercase font-semibold">
            Pendientes
          </div>
          <div className="text-2xl sm:text-3xl font-montserrat font-bold text-amber-400 mt-0.5">
            {stats.pendingGuests}
          </div>
          <div className="text-[10px] text-white/50 font-mono">
            Sin responder
          </div>
        </div>

        <div className="bg-[#141414] border border-white/10 p-3 text-center">
          <div className="text-[9px] font-montserrat tracking-widest text-neutral-400 uppercase font-semibold">
            Total Padrón
          </div>
          <div className="text-2xl sm:text-3xl font-montserrat font-bold text-white mt-0.5">
            {stats.totalInvitations}
          </div>
          <div className="text-[10px] text-white/50 font-mono">
            Invitaciones
          </div>
        </div>
      </div>

      {/* Main Scanner Container */}
      <div className="bg-[#111111] border border-[#C5A059]/40 shadow-2xl overflow-hidden rounded-sm mb-6">
        {/* Header Bar with Tabs */}
        <div className="p-3.5 bg-black/70 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#C5A059]" />
            <span className="font-montserrat text-xs tracking-wider text-white font-bold uppercase">
              Control de Acceso en Puerta
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 bg-[#1f1f1f] hover:bg-[#2c2c2c] text-[#C5A059] border border-white/10 text-xs transition-colors rounded-sm cursor-pointer"
              title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-neutral-500" />}
            </button>

            {/* TAB: Cámara en Vivo */}
            <button
              onClick={() => {
                setActiveMode('camera');
                if (!isCameraActive) startCameraStream();
              }}
              className={`px-3 py-1.5 border font-montserrat text-[10px] tracking-wider uppercase flex items-center gap-1.5 transition-colors rounded-sm cursor-pointer ${
                activeMode === 'camera'
                  ? 'bg-[#C5A059] text-black border-[#C5A059] font-bold'
                  : 'bg-[#1f1f1f] hover:bg-[#2c2c2c] text-white border-white/10'
              }`}
            >
              <Camera className="w-3 h-3" />
              <span>Cámara en Vivo</span>
            </button>

            {/* TAB: Tomar Foto / Subir Archivo QR */}
            <button
              onClick={() => {
                stopCameraStream();
                setActiveMode('photo');
                fileInputRef.current?.click();
              }}
              className={`px-3 py-1.5 border font-montserrat text-[10px] tracking-wider uppercase flex items-center gap-1.5 transition-colors rounded-sm cursor-pointer ${
                activeMode === 'photo'
                  ? 'bg-[#C5A059] text-black border-[#C5A059] font-bold'
                  : 'bg-[#1f1f1f] hover:bg-[#2c2c2c] text-white border-white/10'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>Tomar Foto / QR</span>
            </button>

            {/* TAB: Código Directo */}
            <button
              onClick={() => {
                stopCameraStream();
                setActiveMode('code');
              }}
              className={`px-3 py-1.5 border font-montserrat text-[10px] tracking-wider uppercase flex items-center gap-1.5 transition-colors rounded-sm cursor-pointer ${
                activeMode === 'code'
                  ? 'bg-[#C5A059] text-black border-[#C5A059] font-bold'
                  : 'bg-[#1f1f1f] hover:bg-[#2c2c2c] text-white border-white/10'
              }`}
            >
              <KeyRound className="w-3 h-3" />
              <span>Por Código</span>
            </button>

            {/* TAB: Padrón / Buscar */}
            <button
              onClick={() => {
                stopCameraStream();
                setActiveMode('search');
              }}
              className={`px-3 py-1.5 border font-montserrat text-[10px] tracking-wider uppercase flex items-center gap-1.5 transition-colors rounded-sm cursor-pointer ${
                activeMode === 'search'
                  ? 'bg-[#C5A059] text-black border-[#C5A059] font-bold'
                  : 'bg-[#1f1f1f] hover:bg-[#2c2c2c] text-white border-white/10'
              }`}
            >
              <Search className="w-3 h-3" />
              <span>Padrón</span>
            </button>
          </div>
        </div>

        {/* Hidden Camera File Input with mobile capture support */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Hidden Canvas for Live Video Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Central Viewport Area */}
        <div className="relative bg-black min-h-[340px] flex flex-col items-center justify-center p-4">
          {/* MODE 1: LIVE VIDEO STREAM */}
          {activeMode === 'camera' && (
            <div className="w-full flex flex-col items-center">
              {/* Controls bar */}
              <div className="w-full max-w-sm mb-3 flex items-center justify-between gap-2 text-xs">
                {isCameraActive ? (
                  <>
                    <button
                      onClick={toggleCameraFacing}
                      className="px-2.5 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] text-white border border-white/15 text-[10px] font-montserrat uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 text-[#C5A059]" />
                      <span>{facingMode === 'environment' ? 'Cámara Frontal' : 'Cámara Trasera'}</span>
                    </button>

                    <button
                      onClick={stopCameraStream}
                      className="px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-500/40 text-[10px] font-montserrat uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Power className="w-3 h-3" />
                      <span>Apagar Cámara</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startCameraStream()}
                    disabled={isInitializing}
                    className="w-full py-2.5 px-4 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isInitializing ? 'Iniciando Cámara...' : 'Encender Cámara en Vivo'}</span>
                  </button>
                )}
              </div>

              {/* Viewport Box */}
              <div className="relative w-[280px] sm:w-[320px] h-[280px] sm:h-[320px] bg-neutral-950 border-2 border-[#C5A059]/60 shadow-xl overflow-hidden rounded-sm flex items-center justify-center">
                {/* Live Video Element */}
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                  autoPlay
                  playsInline
                  muted
                />

                {!isCameraActive && !isInitializing && (
                  <div className="text-center p-6 flex flex-col items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-neutral-400">
                      <Camera className="w-7 h-7" />
                    </div>
                    <span className="font-montserrat text-xs text-white/80 font-semibold mb-1">
                      Cámara apagada
                    </span>
                    <p className="text-[11px] text-white/50 max-w-[220px] mb-3 leading-relaxed">
                      Haz clic abajo para iniciar la cámara o usa la opción "Tomar Foto / QR".
                    </p>
                    <button
                      onClick={() => startCameraStream()}
                      className="px-3 py-1.5 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Activar Cámara
                    </button>
                  </div>
                )}

                {isInitializing && (
                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-4 z-30">
                    <RefreshCw className="w-8 h-8 text-[#C5A059] animate-spin mb-2" />
                    <span className="font-montserrat text-xs text-white">Conectando con cámara...</span>
                  </div>
                )}

                {/* Laser scan line overlay */}
                {isCameraActive && (
                  <>
                    <div className="absolute left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent scanner-laser pointer-events-none z-20 shadow-[0_0_8px_#C5A059]"></div>
                    <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-[#C5A059] z-20 pointer-events-none"></div>
                    <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-[#C5A059] z-20 pointer-events-none"></div>
                    <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-[#C5A059] z-20 pointer-events-none"></div>
                    <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-[#C5A059] z-20 pointer-events-none"></div>
                  </>
                )}
              </div>

              {isCameraActive && (
                <div className="mt-3 text-center">
                  <span className="font-montserrat text-[11px] text-white/60 tracking-wider">
                    Apunta la cámara al código QR de la tarjeta digital
                  </span>
                </div>
              )}

              {/* Camera Error or Iframe Diagnostic Banner */}
              {cameraError && (
                <div className="mt-4 p-3.5 bg-rose-950/70 border border-rose-500 text-rose-200 text-xs max-w-md text-center rounded-sm">
                  <div className="font-bold flex items-center justify-center gap-1.5 mb-1 text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Acceso a Cámara no disponible en este entorno
                  </div>
                  <p className="text-[11px] leading-relaxed mb-3">{cameraError}</p>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setActiveMode('photo');
                        fileInputRef.current?.click();
                      }}
                      className="px-3 py-1 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-[10px] font-bold uppercase transition-colors"
                    >
                      📸 Tomar Foto del QR
                    </button>
                    <button
                      onClick={() => setActiveMode('code')}
                      className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white font-montserrat text-[10px] uppercase transition-colors"
                    >
                      Validar por Código
                    </button>
                    {isEmbeddedIframe && (
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-[#C5A059] border border-[#C5A059]/40 font-montserrat text-[10px] uppercase flex items-center gap-1 transition-colors"
                      >
                        <span>Abrir en Pestaña Nueva</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: TOMAR FOTO O SUBIR QR (100% Mobile & Desktop friendly) */}
          {activeMode === 'photo' && (
            <div className="w-full max-w-md my-auto py-6 text-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#C5A059]/60 hover:border-[#C5A059] bg-[#161616] p-8 cursor-pointer transition-colors rounded-sm flex flex-col items-center justify-center group"
              >
                <div className="w-14 h-14 rounded-full bg-[#C5A059]/10 group-hover:bg-[#C5A059]/20 flex items-center justify-center mb-3 transition-colors">
                  <FileImage className="w-7 h-7 text-[#C5A059]" />
                </div>
                <h4 className="font-montserrat text-sm font-bold text-white mb-1">
                  Tomar foto con el celular o subir imagen del QR
                </h4>
                <p className="text-xs text-white/50 max-w-xs mb-3">
                  En celulares abre la cámara directamente. También puedes elegir una captura de pantalla enviada por WhatsApp.
                </p>
                <button
                  type="button"
                  className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {isFileAnalyzing ? 'Decodificando QR...' : 'Abrir Cámara / Galería'}
                </button>
              </div>

              {fileScanError && (
                <div className="mt-3 p-3 bg-rose-950/60 border border-rose-500 text-rose-200 text-xs">
                  {fileScanError}
                </div>
              )}
            </div>
          )}

          {/* MODE 3: MANUAL TOKEN CODE INPUT */}
          {activeMode === 'code' && (
            <div className="w-full max-w-md my-auto py-6">
              <div className="bg-[#161616] border border-[#C5A059]/40 p-5 rounded-sm">
                <label className="block font-montserrat text-xs tracking-wider text-[#C5A059] uppercase font-bold mb-2">
                  Ingresar Código de Invitación
                </label>
                <p className="text-[11px] text-white/60 mb-3">
                  Escribe el token único que figura al pie del QR (ejemplo: <code className="text-[#E7CF98]">DIVO-4921</code>).
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickCodeInput}
                    onChange={(e) => setQuickCodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        processGuestInspection(quickCodeInput);
                      }
                    }}
                    placeholder="Ej: DIVO-4921"
                    autoFocus
                    className="flex-1 bg-black border border-white/20 px-3 py-2 text-sm font-mono text-white placeholder-white/30 uppercase focus:outline-none focus:border-[#C5A059]"
                  />
                  <button
                    onClick={() => processGuestInspection(quickCodeInput)}
                    className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Validar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODE 4: GUEST DIRECTORY SEARCH */}
          {activeMode === 'search' && (
            <div className="w-full max-w-md my-auto py-2">
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-[#C5A059] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por Nombre, Apellido o Código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-[#161616] border border-[#C5A059]/50 pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {searchQuery.trim() === '' ? (
                  <p className="text-center text-xs text-white/40 py-6">
                    Escribe el nombre del invitado para validar su ingreso.
                  </p>
                ) : filteredSearchGuests.length === 0 ? (
                  <p className="text-center text-xs text-rose-400 py-4">
                    No se encontró ningún invitado con ese término.
                  </p>
                ) : (
                  filteredSearchGuests.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => processGuestInspection(g.id)}
                      className="p-3 bg-[#181818] hover:bg-[#222222] border border-white/10 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-montserrat text-xs font-semibold text-white">
                          {g.firstName} {g.lastName}
                        </div>
                        <div className="text-[10px] text-[#C5A059] font-mono">
                          {g.category} {g.tableOrSeat ? `• ${g.tableOrSeat}` : ''}
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 ${
                            g.checkedIn
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : g.status === 'confirmed'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {g.checkedIn ? 'YA INGRESÓ' : g.status === 'confirmed' ? 'CONFIRMADO' : 'PENDIENTE'}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Testing Simulator (Instant verification of admission states) */}
        <div className="px-4 py-2.5 bg-[#0d0d0d] border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-montserrat text-[10px] tracking-wider text-white/50 uppercase font-semibold">
            Simulador Rápido (1 Clic):
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => processGuestInspection('DIVO-4921')}
              className="px-2 py-1 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title="Marcelo Tinelli (Confirmado - Válido)"
            >
              ✓ M. Tinelli (Válido)
            </button>
            <button
              onClick={() => processGuestInspection('DIVO-7832')}
              className="px-2 py-1 bg-purple-950/70 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title="Susana Giménez (Ya ingresó - Alerta)"
            >
              ⚠ S. Giménez (Ya ingresó)
            </button>
            <button
              onClick={() => processGuestInspection('DIVO-5190')}
              className="px-2 py-1 bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title="Mariana Fabbiani (Pendiente)"
            >
              ⏳ M. Fabbiani (Pendiente)
            </button>
            <button
              onClick={() => processGuestInspection('INVALID-999')}
              className="px-2 py-1 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title="Código Inválido"
            >
              ✕ Código Inválido
            </button>
          </div>
        </div>

        {/* ACTIVE SCAN RESULT BANNER / MODAL */}
        {scanResultType && (
          <div
            className={`p-5 border-t-2 transition-all duration-300 ${
              scanResultType === 'valid'
                ? 'bg-[#0f1f14] border-emerald-500'
                : scanResultType === 'already-entered'
                ? 'bg-[#290e11] border-rose-500 animate-pulse'
                : scanResultType === 'not-confirmed'
                ? 'bg-[#241a0d] border-amber-500'
                : 'bg-[#181818] border-neutral-600'
            }`}
          >
            {/* 1. VALID INVITATION & FIRST ENTRY */}
            {scanResultType === 'valid' && scannedGuest && (
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-montserrat text-[10px] tracking-[0.2em] text-emerald-400 font-bold uppercase">
                        {scannedGuest.checkedIn ? 'INGRESO REGISTRADO EXITOSAMENTE' : 'INVITACIÓN VÁLIDA & CONFIRMADA'}
                      </div>
                      <h3 className="font-montserrat text-xl font-bold text-white mt-0.5">
                        {scannedGuest.firstName} {scannedGuest.lastName}
                      </h3>
                      <div className="text-xs text-[#E7CF98] font-mono mt-0.5">
                        {scannedGuest.category} • {scannedGuest.tableOrSeat || 'Sector General'} • Token: {scannedGuest.token}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={clearScan}
                    className="text-white/40 hover:text-white p-1 text-xs cursor-pointer"
                  >
                    ✕ Cerrar
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-500/30 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-black/40 p-2.5 border border-emerald-500/20">
                    <span className="text-neutral-400 block text-[10px]">Acompañantes autorizados:</span>
                    <span className="font-bold text-white">
                      {scannedGuest.confirmedCompanions > 0
                        ? `Titular + ${scannedGuest.confirmedCompanions} (${scannedGuest.companionName || 'Acompañante'})`
                        : 'Ingreso Individual (1 Persona)'}
                    </span>
                  </div>

                  <div className="bg-black/40 p-2.5 border border-emerald-500/20">
                    <span className="text-neutral-400 block text-[10px]">Menú especial:</span>
                    <span className="font-bold text-[#E7CF98]">
                      {scannedGuest.dietaryRestrictions || 'Sin restricciones'}
                    </span>
                  </div>

                  <div className="bg-black/40 p-2.5 border border-emerald-500/20">
                    <span className="text-neutral-400 block text-[10px]">Estado de ingreso:</span>
                    <span className="font-bold text-emerald-400">
                      {scannedGuest.checkedIn
                        ? `Ingresó a las ${new Date(scannedGuest.checkedInAt!).toLocaleTimeString('es-AR')}`
                        : 'En puerta (Listo para ingresar)'}
                    </span>
                  </div>
                </div>

                {/* Admission Action */}
                {!scannedGuest.checkedIn ? (
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => handleConfirmAdmission(false)}
                      disabled={isSubmittingCheckIn}
                      className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-montserrat text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{isSubmittingCheckIn ? 'Registrando...' : 'Marcar Ingreso a Sala'}</span>
                    </button>
                    <button
                      onClick={clearScan}
                      className="py-3 px-4 bg-black/50 hover:bg-black text-white/80 border border-white/20 font-montserrat text-xs tracking-wider uppercase cursor-pointer"
                    >
                      Siguiente
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Ingreso completado correctamente.
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUndoAdmission}
                        disabled={isSubmittingCheckIn}
                        className="py-1.5 px-3 bg-transparent hover:bg-white/10 text-white/60 hover:text-white border border-white/20 text-[10px] font-montserrat uppercase transition-colors cursor-pointer"
                      >
                        Deshacer ingreso
                      </button>
                      <button
                        onClick={clearScan}
                        className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-black font-montserrat text-xs font-bold uppercase transition-colors cursor-pointer"
                      >
                        Listo / Escanear siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. ALREADY CHECKED IN (FRAUD / DUPLICATE PROTECTION) */}
            {scanResultType === 'already-entered' && scannedGuest && (
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-400 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-6 h-6 text-rose-400" />
                    </div>
                    <div>
                      <div className="font-montserrat text-[10px] tracking-[0.2em] text-rose-400 font-black uppercase">
                        ¡ALERTA DE REINGRESO! INVITACIÓN YA UTILIZADA
                      </div>
                      <h3 className="font-montserrat text-xl font-bold text-white mt-0.5">
                        {scannedGuest.firstName} {scannedGuest.lastName}
                      </h3>
                      <div className="text-xs text-rose-200 font-mono mt-0.5">
                        Esta invitación ya fue escaneada y registrada a las{' '}
                        <strong className="underline text-white">
                          {alreadyCheckedInTime
                            ? new Date(alreadyCheckedInTime).toLocaleTimeString('es-AR')
                            : 'horario anterior'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={clearScan}
                    className="text-white/40 hover:text-white p-1 text-xs cursor-pointer"
                  >
                    ✕ Cerrar
                  </button>
                </div>

                <div className="mt-3 p-3 bg-black/60 border border-rose-500/30 text-xs text-rose-200">
                  ⚠️ <strong>Aviso para recepción / seguridad:</strong> Verifica la identidad del invitado
                  para asegurar que no se trate de una captura de pantalla compartida.
                </div>

                <div className="mt-4 flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => handleConfirmAdmission(true)}
                    disabled={isSubmittingCheckIn}
                    className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-montserrat text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    Autorizar Reingreso Excepcional
                  </button>
                  <button
                    onClick={clearScan}
                    className="py-2.5 px-4 bg-black/60 hover:bg-black text-white border border-white/20 font-montserrat text-xs tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    Rechazar / Siguiente
                  </button>
                </div>
              </div>
            )}

            {/* 3. NOT CONFIRMED / DECLINED */}
            {scanResultType === 'not-confirmed' && scannedGuest && (
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <div className="font-montserrat text-[10px] tracking-[0.2em] text-amber-400 font-bold uppercase">
                        INVITACIÓN NO CONFIRMADA
                      </div>
                      <h3 className="font-montserrat text-xl font-bold text-white mt-0.5">
                        {scannedGuest.firstName} {scannedGuest.lastName}
                      </h3>
                      <div className="text-xs text-amber-200 font-mono mt-0.5">
                        Estado RSVP actual:{' '}
                        <strong>{scannedGuest.status === 'declined' ? 'Había cancelado (No asiste)' : 'Pendiente sin confirmar'}</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={clearScan}
                    className="text-white/40 hover:text-white p-1 text-xs cursor-pointer"
                  >
                    ✕ Cerrar
                  </button>
                </div>

                <div className="mt-3 p-3 bg-black/60 border border-amber-500/30 text-xs text-amber-200">
                  El invitado figura en el padrón oficial pero no confirmó previamente su asistencia.
                </div>

                <div className="mt-4 flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={() => handleConfirmAdmission(true)}
                    disabled={isSubmittingCheckIn}
                    className="py-2.5 px-4 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    Permitir Ingreso en Puerta
                  </button>
                  <button
                    onClick={clearScan}
                    className="py-2.5 px-4 bg-black/60 hover:bg-black text-white border border-white/20 font-montserrat text-xs tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}

            {/* 4. CODE NOT FOUND */}
            {scanResultType === 'not-found' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                  <div>
                    <h4 className="font-montserrat text-sm font-bold text-rose-400 uppercase">
                      Código QR no registrado
                    </h4>
                    <p className="text-xs text-white/70">
                      Este código no pertenece a ninguna invitación del evento Divo 20 Años.
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearScan}
                  className="py-1.5 px-3 bg-white/10 hover:bg-white/20 text-white font-montserrat text-xs uppercase cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real-time Guest Attendance History */}
      <div className="bg-[#111111] border border-white/10 p-4 rounded-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-montserrat text-xs tracking-widest text-[#C5A059] uppercase font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Últimos Ingresos Registrados en Puerta
          </h3>
          <span className="font-mono text-[11px] text-white/40">
            {stats.checkedInGuests} de {stats.totalInvitations} invitaciones ingresadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-neutral-400 font-montserrat text-[10px] tracking-wider uppercase">
                <th className="py-2 px-3">Invitado</th>
                <th className="py-2 px-3">Categoría</th>
                <th className="py-2 px-3">Acompañantes</th>
                <th className="py-2 px-3">Hora Ingreso</th>
                <th className="py-2 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {guests
                .filter((g) => g.checkedIn)
                .sort((a, b) => new Date(b.checkedInAt || 0).getTime() - new Date(a.checkedInAt || 0).getTime())
                .slice(0, 8)
                .map((guest) => (
                  <tr key={guest.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 font-montserrat font-semibold text-white">
                      {guest.firstName} {guest.lastName}
                    </td>
                    <td className="py-2.5 px-3 text-[#E7CF98]">
                      {guest.category}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-300">
                      {guest.confirmedCompanions > 0 ? `+${guest.confirmedCompanions} (${guest.companionName || 'Acomp.'})` : 'Individual'}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">
                      {guest.checkedInAt ? new Date(guest.checkedInAt).toLocaleTimeString('es-AR') : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => {
                          GuestService.undoCheckIn(guest.id);
                        }}
                        className="text-[10px] text-neutral-400 hover:text-rose-400 underline cursor-pointer"
                      >
                        Anular
                      </button>
                    </td>
                  </tr>
                ))}
              {guests.filter((g) => g.checkedIn).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-white/40 font-montserrat">
                    Aún no se han registrado ingresos en sala para hoy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
