import React, { useEffect, useState, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
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
  Power,
  Eye,
  Check,
  QrCode,
  Wifi,
  WifiOff
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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isSuccessFlashing, setIsSuccessFlashing] = useState(false);

  // Active scan result modal state
  const [scannedGuest, setScannedGuest] = useState<Guest | null>(null);
  const [scanResultType, setScanResultType] = useState<'valid' | 'already-entered' | 'not-confirmed' | 'not-found' | null>(null);
  const [alreadyCheckedInTime, setAlreadyCheckedInTime] = useState<string | null>(null);
  const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
  const [staffName, setStaffName] = useState('Acceso Principal - Capilla Buen Pastor');

  // Input modes: live camera, take photo / file upload, manual code, search padrón
  const [activeMode, setActiveMode] = useState<'camera' | 'photo' | 'code' | 'search'>('camera');
  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFileAnalyzing, setIsFileAnalyzing] = useState(false);
  const [fileScanError, setFileScanError] = useState<string | null>(null);

  // Test QR Modal for easy testing between devices or screens
  const [showTestQrModal, setShowTestQrModal] = useState(false);
  const [sampleQrDataUrl, setSampleQrDataUrl] = useState<string>('');
  const [selectedSampleGuest, setSelectedSampleGuest] = useState<Guest | null>(null);

  // Detect if running inside iframe
  const [isEmbeddedIframe, setIsEmbeddedIframe] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const isScanningFrame = useRef(false);
  const lastScanTimestamp = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nativeDetectorRef = useRef<any>(null);

  const stats = calculateStats(guests);

  useEffect(() => {
    try {
      setIsEmbeddedIframe(window.self !== window.top);
    } catch {
      setIsEmbeddedIframe(true);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize native BarcodeDetector if supported by browser
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        nativeDetectorRef.current = new (window as any).BarcodeDetector({
          formats: ['qr_code'],
        });
        console.log('Native BarcodeDetector initialized successfully');
      } catch (e) {
        console.warn('Native BarcodeDetector not available, using jsQR fallback', e);
      }
    }

    // Prepare sample QR for the test modal
    const sample = guests.find((g) => g.status === 'confirmed' && !g.checkedIn) || guests[0];
    if (sample) {
      setSelectedSampleGuest(sample);
      const payload = GuestService.getQRPayload(sample);
      QRCode.toDataURL(payload, { width: 320, margin: 2 })
        .then((data) => setSampleQrDataUrl(data))
        .catch(() => {});
    }
  }, [guests]);

  // Audio cue synth
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
        // Luxury celebration major chord
        const now = ctx.currentTime;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.start(now);
        osc.stop(now + 0.39);
      } else if (type === 'alert') {
        // Duplicate entry alert tone
        const now = ctx.currentTime;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.setValueAtTime(0.01, now + 0.12);
        gain.gain.setValueAtTime(0.4, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.33);
      } else {
        // Error tone
        const now = ctx.currentTime;
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.26);
      }
    } catch {
      // Audio not supported
    }
  };

  // Safe stop camera stream and scanning loop
  const stopCameraStream = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setTorchAvailable(false);
    setTorchOn(false);
  };

  // Toggle mobile torch/flashlight if supported
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch not supported on this track', err);
    }
  };

  // Start video stream with robust fallbacks
  const startCameraStream = async (requestedFacing?: 'environment' | 'user') => {
    stopCameraStream();
    setIsInitializing(true);
    setCameraError(null);

    const targetFacing = requestedFacing || facingMode;

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(
        'Este navegador no permite acceso directo a la cámara. Por favor utiliza la opción "Tomar Foto / QR" o "Por Código".'
      );
      setIsInitializing(false);
      return;
    }

    try {
      let stream: MediaStream | null = null;

      // 1. Try back/environment camera with optimal resolution
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Ideal facing mode failed, trying basic video constraints...', err1);
        // 2. Fallback to any available video (e.g. laptop webcam)
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

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0];
      if (track && (track.getCapabilities as any)) {
        try {
          const caps = (track.getCapabilities as any)();
          if (caps && 'torch' in caps) {
            setTorchAvailable(true);
          }
        } catch {}
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Auto play was interrupted', playErr);
        }
      }

      setIsCameraActive(true);
      setCameraError(null);

      // Start continuous scanning loop (every 90ms for fluid responsiveness & low CPU)
      startContinuousScanner();
    } catch (err: any) {
      console.error('Camera access error:', err);
      let msg = 'No se pudo acceder a la cámara.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Permiso denegado por el navegador. Haz clic en el candado de la barra de direcciones para permitir la cámara.';
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

  // High-performance QR scanning loop (Dual Engine: Native BarcodeDetector + Optimized Downscaled jsQR)
  const startContinuousScanner = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    // Run every 90ms (approx 11 checks per second, ideal for QR without lag)
    scanIntervalRef.current = setInterval(async () => {
      if (isScanningFrame.current) return;
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      // Throttle rapid duplicate scans
      const now = Date.now();
      if (now - lastScanTimestamp.current < 1200) {
        return;
      }

      isScanningFrame.current = true;

      try {
        let detectedText: string | null = null;

        // ENGINE 1: Hardware-accelerated Native BarcodeDetector (iOS 17+, Android Chrome)
        if (nativeDetectorRef.current) {
          try {
            const barcodes = await nativeDetectorRef.current.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              detectedText = barcodes[0].rawValue;
            }
          } catch (e) {
            // fallback to jsQR
          }
        }

        // ENGINE 2: Optimized jsQR on scaled-down buffer
        if (!detectedText) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (ctx) {
            // Downscale to ~480px width for 10x faster decoding and zero dropped frames
            const maxDimension = 540;
            let targetWidth = video.videoWidth;
            let targetHeight = video.videoHeight;

            if (targetWidth > maxDimension || targetHeight > maxDimension) {
              const ratio = Math.min(maxDimension / targetWidth, maxDimension / targetHeight);
              targetWidth = Math.round(targetWidth * ratio);
              targetHeight = Math.round(targetHeight * ratio);
            }

            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
              canvas.width = targetWidth;
              canvas.height = targetHeight;
            }

            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);

            const code = jsQR(imageData.data, targetWidth, targetHeight, {
              inversionAttempts: 'attemptBoth',
            });

            if (code && code.data) {
              detectedText = code.data;
            }
          }
        }

        // Process found QR code
        if (detectedText) {
          lastScanTimestamp.current = Date.now();
          setLastScannedCode(detectedText);
          setIsSuccessFlashing(true);
          setTimeout(() => setIsSuccessFlashing(false), 800);

          if (navigator.vibrate) {
            try {
              navigator.vibrate([80, 40, 80]);
            } catch {}
          }

          handleQrCodeDecoded(detectedText);
        }
      } catch (err) {
        console.warn('Scanner frame evaluation error:', err);
      } finally {
        isScanningFrame.current = false;
      }
    }, 90);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Switch camera facing mode
  const toggleCameraFacing = async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (isCameraActive) {
      await startCameraStream(next);
    }
  };

  // Decode QR and identify guest (supports URLs, Official Pass Credentials, WhatsApp links, and cross-device hydration)
  const handleQrCodeDecoded = (decodedText: string) => {
    processGuestInspection(decodedText);
  };

  // Inspect guest by QR payload, URL, token, ID, or full name
  const processGuestInspection = async (rawInput: string) => {
    const trimmed = (rawInput || '').trim();
    if (!trimmed) return;

    // 1. Universal resolution + self-hydration if scanned from another device
    const resolved = GuestService.resolveGuestFromQRText(trimmed, guests);
    let match = resolved.guest;

    // 2. If not in local list yet, query server directly before showing any error
    if (!match && resolved.tokenOrQuery) {
      const remoteGuest = await GuestService.getGuestByIdOrToken(resolved.tokenOrQuery);
      if (remoteGuest) {
        match = remoteGuest;
        if (onGuestUpdated) {
          onGuestUpdated(remoteGuest);
        }
      }
    }

    if (!match) {
      setScanResultType('not-found');
      setScannedGuest(null);
      playSound('error');
      return;
    }

    // Notify parent if guest was newly hydrated from QR
    if (!guests.some((g) => g.id === match!.id) && onGuestUpdated) {
      onGuestUpdated(match);
    }

    setScannedGuest(match);

    if (match.checkedIn) {
      setScanResultType('already-entered');
      setAlreadyCheckedInTime(match.checkedInAt || null);
      playSound('alert');
    } else if (match.status === 'declined') {
      setScanResultType('not-confirmed');
      playSound('alert');
    } else {
      setScanResultType('valid');
      playSound('success');
    }
  };

  // Process uploaded image file or photo capture (supports both standalone QR and full 760x1280 Invitation Card)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileAnalyzing(true);
    setFileScanError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          let foundText: string | null = null;

          // 1. Try native detector if available
          if (nativeDetectorRef.current) {
            try {
              const barcodes = await nativeDetectorRef.current.detect(img);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                foundText = barcodes[0].rawValue;
              }
            } catch {}
          }

          // Helper to scan a specific region/scale on canvas with jsQR
          const scanRegion = (
            sx: number,
            sy: number,
            sw: number,
            sh: number,
            targetSize: number = 700
          ): string | null => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(targetSize / sw, targetSize / sh, 2.5);
            const dw = Math.max(120, Math.round(sw * scale));
            const dh = Math.max(120, Math.round(sh * scale));
            canvas.width = dw;
            canvas.height = dh;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
            const imageData = ctx.getImageData(0, 0, dw, dh);
            const code = jsQR(imageData.data, dw, dh, {
              inversionAttempts: 'attemptBoth',
            });
            return code && code.data ? code.data : null;
          };

          const W = img.width;
          const H = img.height;

          // 2. Multi-pass jsQR (Full image, then bottom-right QR region of Invitation Card, then bottom half, then center)
          if (!foundText) {
            foundText =
              scanRegion(0, 0, W, H, 900) ||
              scanRegion(0, 0, W, H, 550) ||
              scanRegion(Math.floor(W * 0.45), Math.floor(H * 0.55), Math.floor(W * 0.55), Math.floor(H * 0.45), 600) ||
              scanRegion(0, Math.floor(H * 0.5), W, Math.floor(H * 0.5), 750) ||
              scanRegion(Math.floor(W * 0.15), Math.floor(H * 0.15), Math.floor(W * 0.7), Math.floor(H * 0.7), 650);
          }

          if (foundText) {
            handleQrCodeDecoded(foundText);
            setFileScanError(null);
          } else {
            setFileScanError(
              'No se encontró un código QR legible en esta foto. Asegúrate de enfocar bien el QR o ingresa el código manual.'
            );
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
    setLastScannedCode(null);
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
        <div className="bg-[#141414] border border-[#C5A059]/30 p-3 text-center rounded-sm">
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

        <div className="bg-[#141414] border border-emerald-500/30 p-3 text-center rounded-sm">
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

        <div className="bg-[#141414] border border-amber-500/30 p-3 text-center rounded-sm">
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

        <div className="bg-[#141414] border border-white/10 p-3 text-center rounded-sm">
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
            <div
              className={`px-2 py-0.5 rounded-full text-[9px] font-mono flex items-center gap-1 ${
                isOnline
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/80 border border-amber-500/60 text-amber-300 animate-pulse'
              }`}
              title={isOnline ? 'Conectado a la red' : 'Modo Offline blindado: Los escaneos se guardan en el dispositivo'}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  <span>Modo Offline Activo</span>
                </>
              )}
            </div>
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

            {/* TAB: Tomar Foto / QR */}
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
              <span>Foto / Archivo QR</span>
            </button>

            {/* TAB: Por Código */}
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

            {/* TAB: Buscar en Padrón */}
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

        {/* Hidden Camera File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Hidden Offscreen Canvas for Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewport Area */}
        <div className="relative bg-black min-h-[350px] flex flex-col items-center justify-center p-4">
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
                      <span>{facingMode === 'environment' ? 'Cambiar a Frontal' : 'Cambiar a Trasera'}</span>
                    </button>

                    {torchAvailable && (
                      <button
                        onClick={toggleTorch}
                        className={`px-2.5 py-1.5 border text-[10px] font-montserrat uppercase flex items-center gap-1.5 transition-colors cursor-pointer ${
                          torchOn
                            ? 'bg-[#C5A059] text-black border-[#C5A059] font-bold'
                            : 'bg-[#1a1a1a] hover:bg-[#252525] text-white border-white/15'
                        }`}
                      >
                        <Zap className="w-3 h-3" />
                        <span>{torchOn ? 'Linterna ON' : 'Linterna'}</span>
                      </button>
                    )}

                    <button
                      onClick={stopCameraStream}
                      className="px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-500/40 text-[10px] font-montserrat uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Power className="w-3 h-3" />
                      <span>Detener</span>
                    </button>
                  </>
                ) : (
                  <div className="w-full flex flex-col gap-2">
                    <button
                      onClick={() => startCameraStream()}
                      disabled={isInitializing}
                      className="w-full py-3 px-4 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{isInitializing ? 'Conectando con cámara...' : 'Encender Cámara en Vivo'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Viewport Box */}
              <div
                className={`relative w-[280px] sm:w-[320px] h-[280px] sm:h-[320px] bg-neutral-950 border-2 overflow-hidden rounded-sm flex items-center justify-center transition-all duration-300 ${
                  isSuccessFlashing
                    ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.8)]'
                    : 'border-[#C5A059]/70 shadow-2xl'
                }`}
              >
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
                    <span className="font-montserrat text-xs text-white/90 font-semibold mb-1">
                      Cámara en espera
                    </span>
                    <p className="text-[11px] text-white/50 max-w-[220px] mb-3 leading-relaxed">
                      Haz clic en "Encender Cámara" para comenzar el escaneo en vivo en la puerta.
                    </p>
                    <button
                      onClick={() => startCameraStream()}
                      className="px-3.5 py-1.5 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Activar Cámara Ahora
                    </button>
                  </div>
                )}

                {isInitializing && (
                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-4 z-30">
                    <RefreshCw className="w-8 h-8 text-[#C5A059] animate-spin mb-2" />
                    <span className="font-montserrat text-xs text-white">Iniciando sensor de cámara...</span>
                  </div>
                )}

                {/* Laser scan line overlay & luxury brackets */}
                {isCameraActive && (
                  <>
                    <div className="absolute left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent scanner-laser pointer-events-none z-20 shadow-[0_0_8px_#C5A059]"></div>
                    <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-[#C5A059] z-20 pointer-events-none"></div>
                    <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-[#C5A059] z-20 pointer-events-none"></div>
                    <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-[#C5A059] z-20 pointer-events-none"></div>
                    <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-[#C5A059] z-20 pointer-events-none"></div>

                    <div className="absolute bottom-2 left-0 right-0 text-center z-20 pointer-events-none">
                      <span className="inline-block px-2 py-0.5 bg-black/70 backdrop-blur-sm border border-white/10 text-[9px] font-mono text-emerald-400 font-semibold tracking-wider uppercase">
                        ● Escáner Activo
                      </span>
                    </div>
                  </>
                )}
              </div>

              {isCameraActive && (
                <div className="mt-3 text-center flex items-center gap-2">
                  <span className="font-montserrat text-[11px] text-white/70 tracking-wider">
                    Apunta la cámara al código QR de la tarjeta digital
                  </span>
                </div>
              )}

              {/* Camera Error Banner */}
              {cameraError && (
                <div className="mt-4 p-3.5 bg-rose-950/80 border border-rose-500 text-rose-200 text-xs max-w-md text-center rounded-sm">
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
                      className="px-3 py-1 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-[10px] font-bold uppercase transition-colors cursor-pointer"
                    >
                      📸 Tomar Foto del QR
                    </button>
                    <button
                      onClick={() => setActiveMode('code')}
                      className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white font-montserrat text-[10px] uppercase transition-colors cursor-pointer"
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

          {/* MODE 2: TOMAR FOTO O SUBIR QR */}
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
                  Tomar foto o subir imagen del QR
                </h4>
                <p className="text-xs text-white/50 max-w-xs mb-3">
                  En teléfonos celulares abre la cámara de fotos directamente. También puedes elegir una foto guardada o captura de pantalla.
                </p>
                <button
                  type="button"
                  className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {isFileAnalyzing ? 'Decodificando código...' : 'Abrir Cámara de Fotos / Archivo'}
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
                  Ingresar Token o Nombre del Invitado
                </label>
                <p className="text-[11px] text-white/60 mb-3">
                  Escribe el token único de la tarjeta (ej: <code className="text-[#E7CF98]">tk-pablo-honor-01</code>) o el nombre del invitado.
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
                    placeholder="Ej: tk-pablo-honor-01 o Pablo Moreno"
                    autoFocus
                    className="flex-1 bg-black border border-white/20 px-3 py-2 text-sm font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#C5A059]"
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
                    Escribe el nombre del invitado para validar su ingreso manualmente.
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
                          {g.category} {g.tableOrSeat ? `• ${g.tableOrSeat}` : ''} • {g.token}
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

        {/* Quick Simulator Bar with REAL GUEST TOKENS and QR Test Card Button */}
        <div className="px-4 py-2.5 bg-[#0d0d0d] border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-montserrat text-[10px] tracking-wider text-white/50 uppercase font-semibold">
              Simulador con Invitados Reales:
            </span>
            <button
              onClick={() => setShowTestQrModal(true)}
              className="px-2 py-1 bg-[#C5A059]/20 hover:bg-[#C5A059]/30 text-[#E7CF98] border border-[#C5A059]/40 text-[10px] font-montserrat uppercase flex items-center gap-1 transition-colors cursor-pointer"
              title="Mostrar un código QR en pantalla para apuntar con la cámara"
            >
              <QrCode className="w-3 h-3" />
              <span>Ver QR de Prueba</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => processGuestInspection('tk-pablo-honor-01')}
              className="px-2 py-1 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title="Pablo Moreno (Confirmado - Válido)"
            >
              ✓ P. Moreno (Válido)
            </button>
            <button
              onClick={() => processGuestInspection('tk-valeria-vip-02')}
              className="px-2 py-1 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title="Valeria Mazza (Confirmada - Válida)"
            >
              ✓ V. Mazza (Válido)
            </button>
            <button
              onClick={() => processGuestInspection('tk-marcos-vip-03')}
              className="px-2 py-1 bg-purple-950/70 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title="Marcos Villalobos (Ya ingresó - Alerta de duplicado)"
            >
              ⚠ M. Villalobos (Ya ingresó)
            </button>
            <button
              onClick={() => processGuestInspection('tk-lucas-inv-05')}
              className="px-2 py-1 bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title="Lucas Sarmiento (Pendiente)"
            >
              ⏳ L. Sarmiento (Pendiente)
            </button>
            <button
              onClick={() => processGuestInspection('INVALID-CODE-999')}
              className="px-2 py-1 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold transition-colors cursor-pointer"
              title="Código no registrado"
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
            {/* 1. VALID INVITATION */}
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
                    <span className="text-neutral-400 block text-[10px]">Ubicación / Sector:</span>
                    <span className="font-bold text-[#E7CF98]">
                      {scannedGuest.tableOrSeat || 'Sector General'}
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
                        Listo / Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. ALREADY CHECKED IN */}
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
                        Esta invitación ya fue escaneada e ingresó a las{' '}
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

            {/* 3. NOT CONFIRMED */}
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
                        <strong>{scannedGuest.status === 'declined' ? 'Había indicado que no asiste' : 'Pendiente sin confirmar'}</strong>
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
                  Cerrar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attendance History Table */}
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

      {/* MODAL: QR CODE CARD FOR LIVE CAMERA TESTING */}
      {showTestQrModal && selectedSampleGuest && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#C5A059] max-w-sm w-full p-6 text-center shadow-2xl relative">
            <button
              onClick={() => setShowTestQrModal(false)}
              className="absolute top-3 right-3 text-neutral-400 hover:text-white p-1 text-xs"
            >
              ✕
            </button>

            <span className="font-montserrat text-[10px] tracking-[0.2em] text-[#C5A059] uppercase font-bold">
              QR Oficial de Muestra
            </span>
            <h3 className="font-montserrat text-lg font-bold text-white mt-1">
              {selectedSampleGuest.firstName} {selectedSampleGuest.lastName}
            </h3>
            <p className="text-xs text-white/60 mb-4">
              Apunta la cámara de tu celular o webcam a este código QR para probar la lectura en tiempo real.
            </p>

            <div className="bg-white p-4 inline-block rounded-sm shadow-xl mb-4 border border-[#C5A059]">
              {sampleQrDataUrl ? (
                <img src={sampleQrDataUrl} alt="QR de muestra" className="w-48 h-48 block mx-auto" />
              ) : (
                <div className="w-48 h-48 bg-neutral-200 animate-pulse"></div>
              )}
              <span className="font-mono text-[9px] text-black font-bold block mt-1">
                {selectedSampleGuest.token}
              </span>
            </div>

            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setShowTestQrModal(false);
                  processGuestInspection(selectedSampleGuest.token);
                }}
                className="px-3 py-1.5 bg-[#C5A059] hover:bg-[#d4af37] text-black font-montserrat text-xs font-bold uppercase transition-colors"
              >
                Validar este invitado
              </button>
              <button
                onClick={() => setShowTestQrModal(false)}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-montserrat text-xs uppercase"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
