import QRCode from 'qrcode';
import { Guest } from '../types/guest';
import { GuestService, QRContentMode } from '../services/guestService';
import { getCustomLogoUrl } from '../components/brand/DivoLogo';

function getQRLib(): any {
  return (QRCode as any)?.create || (QRCode as any)?.toDataURL
    ? QRCode
    : (QRCode as any)?.default || QRCode;
}

/**
 * Draws a crisp, pixel-aligned QR code matrix directly onto a 2D canvas context
 * with zero bilinear scaling blur, ensuring 100% instant readability by phone cameras and jsQR.
 */
export function drawQRCodeDirectlyOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  boxX: number,
  boxY: number,
  boxSize: number,
  marginModules: number = 3
): boolean {
  const safeText = (text || 'DIVO 20 ANOS').trim();
  try {
    const qrLib = getQRLib();
    if (qrLib && typeof qrLib.create === 'function') {
      const qrData = qrLib.create(safeText, { errorCorrectionLevel: 'M' });
      const moduleCount = qrData.modules.size;
      const totalModules = moduleCount + marginModules * 2;

      // Fill pure white quiet zone
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(boxX, boxY, boxSize, boxSize);

      // Integer pixel module size for razor-sharp edges
      const cellSize = Math.max(2, Math.floor(boxSize / totalModules));
      const actualGridSize = cellSize * totalModules;
      const offsetX = boxX + Math.floor((boxSize - actualGridSize) / 2);
      const offsetY = boxY + Math.floor((boxSize - actualGridSize) / 2);

      ctx.fillStyle = '#000000';
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qrData.modules.get(r, c)) {
            ctx.fillRect(
              offsetX + (c + marginModules) * cellSize,
              offsetY + (r + marginModules) * cellSize,
              cellSize,
              cellSize
            );
          }
        }
      }
      return true;
    }
  } catch (err) {
    console.warn('Direct QR matrix draw fallback:', err);
  }
  return false;
}

/**
 * Safely generates a razor-sharp QR code PNG Data URL in any browser/bundler environment.
 */
export async function generateQRDataUrl(
  text: string,
  width: number = 400,
  margin: number = 3
): Promise<string> {
  const safeText = (text || 'DIVO 20 ANOS').trim();
  try {
    const qrLib = getQRLib();

    // Primary: Crisp integer-pixel canvas rendering via QRCode.create
    if (qrLib && typeof qrLib.create === 'function' && typeof document !== 'undefined') {
      const qrData = qrLib.create(safeText, { errorCorrectionLevel: 'M' });
      const moduleCount = qrData.modules.size;
      const totalModules = moduleCount + margin * 2;
      const cellSize = Math.max(4, Math.ceil(width / totalModules));
      const exactCanvasSize = cellSize * totalModules;

      const canvas = document.createElement('canvas');
      canvas.width = exactCanvasSize;
      canvas.height = exactCanvasSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, exactCanvasSize, exactCanvasSize);
        ctx.fillStyle = '#000000';
        for (let r = 0; r < moduleCount; r++) {
          for (let c = 0; c < moduleCount; c++) {
            if (qrData.modules.get(r, c)) {
              ctx.fillRect(
                (c + margin) * cellSize,
                (r + margin) * cellSize,
                cellSize,
                cellSize
              );
            }
          }
        }
        return canvas.toDataURL('image/png', 1.0);
      }
    }

    // Secondary fallback: qrLib.toDataURL
    if (qrLib && typeof qrLib.toDataURL === 'function') {
      return await qrLib.toDataURL(safeText, {
        width,
        margin,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      });
    }
  } catch (err) {
    console.error('Error in generateQRDataUrl:', err);
  }
  return '';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Renders the complete Luxury DIVO 20 Años Invitation Card with QR Code
 * directly onto a high-resolution HTML5 Canvas (760 x 1280 px) and returns a PNG Data URL.
 * Works 100% offline/online, inside iframes, without any CORS font errors.
 */
export async function renderInvitationCardToDataUrl(
  guest: Guest,
  qrModeOverride?: QRContentMode
): Promise<string> {
  const W = 760;
  const H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  ctx.imageSmoothingEnabled = false;

  // 1. Background (#0d0d0d)
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, W, H);

  // Subtle radial gold glow top-left & center
  const radialGlow = ctx.createRadialGradient(140, 140, 10, 140, 140, 420);
  radialGlow.addColorStop(0, 'rgba(197, 160, 89, 0.14)');
  radialGlow.addColorStop(1, 'rgba(197, 160, 89, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot pattern
  ctx.fillStyle = 'rgba(197, 160, 89, 0.04)';
  for (let x = 24; x < W; x += 32) {
    for (let y = 24; y < H; y += 32) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Outer Gold Border
  ctx.strokeStyle = 'rgba(197, 160, 89, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  // Corner Damask Accents
  ctx.strokeStyle = '#C5A059';
  ctx.lineWidth = 3;
  const cornerLen = 28;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(28, 28 + cornerLen);
  ctx.lineTo(28, 28);
  ctx.lineTo(28 + cornerLen, 28);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(W - 28 - cornerLen, 28);
  ctx.lineTo(W - 28, 28);
  ctx.lineTo(W - 28, 28 + cornerLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(28, H - 28 - cornerLen);
  ctx.lineTo(28, H - 28);
  ctx.lineTo(28 + cornerLen, H - 28);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(W - 28 - cornerLen, H - 28);
  ctx.lineTo(W - 28, H - 28);
  ctx.lineTo(W - 28, H - 28 - cornerLen);
  ctx.stroke();

  // 2. TOP SECTION: Guest Info on Left + QR Code Box on Right
  const padX = 56;
  const topY = 68;

  // Vertical Gold Accent Bar
  ctx.fillStyle = '#C5A059';
  ctx.fillRect(padX, topY, 4, 118);

  // "INVITACIÓN ESPECIAL"
  ctx.fillStyle = '#C5A059';
  ctx.font = '700 18px Montserrat, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('INVITACIÓN ESPECIAL', padX + 20, topY + 22);

  // Guest Full Name
  const fullName = `${guest.firstName} ${guest.lastName}`.trim();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = fullName.length > 22 ? '700 24px Montserrat, sans-serif' : '700 28px Montserrat, sans-serif';
  ctx.fillText(fullName, padX + 20, topY + 60);

  // Pass / Companions Text
  const passText =
    guest.status === 'confirmed'
      ? guest.confirmedCompanions > 0
        ? `PASE: TITULAR + ${guest.confirmedCompanions} (${(guest.companionName || 'ACOMPAÑANTE').toUpperCase()})`
        : 'PASE EXCLUSIVO INDIVIDUAL'
      : guest.companionsAllowed > 0
      ? `PASE: TITULAR + ${guest.companionsAllowed} ACOMPAÑANTE`
      : 'PASE EXCLUSIVO INDIVIDUAL';

  ctx.fillStyle = 'rgba(250, 247, 242, 0.65)';
  ctx.font = '500 15px Montserrat, sans-serif';
  ctx.fillText(passText, padX + 20, topY + 90);

  // Category & Table Pill
  if (guest.category) {
    ctx.fillStyle = 'rgba(197, 160, 89, 0.16)';
    ctx.fillRect(padX + 20, topY + 104, 190, 28);
    ctx.strokeStyle = 'rgba(197, 160, 89, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX + 20, topY + 104, 190, 28);
    ctx.fillStyle = '#E7CF98';
    ctx.font = '700 13px monospace';
    ctx.fillText(guest.category.toUpperCase(), padX + 30, topY + 123);
  }

  // Right QR Code Box (High-contrast, integer-pixel aligned for instant scanning)
  const qrPayload = GuestService.getQRPayload(guest, qrModeOverride);
  const qrBoxSize = 204;
  const qrBoxX = W - padX - qrBoxSize;
  const qrBoxY = topY - 8;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize + 28);
  ctx.strokeStyle = '#C5A059';
  ctx.lineWidth = 2;
  ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize + 28);

  const drawnDirectly = drawQRCodeDirectlyOnCanvas(ctx, qrPayload, qrBoxX + 6, qrBoxY + 6, qrBoxSize - 12, 3);
  if (!drawnDirectly) {
    const qrUrl = await generateQRDataUrl(qrPayload, 400, 3);
    if (qrUrl) {
      try {
        const qrImg = await loadImage(qrUrl);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qrImg, qrBoxX + 8, qrBoxY + 8, qrBoxSize - 16, qrBoxSize - 16);
      } catch (e) {
        console.warn('Could not draw QR image on canvas', e);
      }
    }
  }

  ctx.fillStyle = '#000000';
  ctx.font = '700 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(guest.token.substring(0, 14).toUpperCase(), qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize + 18);

  // 3. MIDDLE SECTION: "20 años" + "VISTIENDO MOMENTOS" + Event Details
  const midY = 470;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#C5A059';
  ctx.font = '700 132px "Old Standard TT", Georgia, serif';
  ctx.fillText('20', padX, midY);

  ctx.font = 'italic 76px "Old Standard TT", Georgia, serif';
  ctx.fillText('años', padX + 168, midY - 6);

  ctx.fillStyle = '#FAF7F2';
  ctx.font = '600 19px Montserrat, sans-serif';
  ctx.fillText('V I S T I E N D O   M O M E N T O S', padX + 4, midY + 42);

  // Event Details Block with left gold line
  const detailsY = midY + 95;
  ctx.fillStyle = 'rgba(197, 160, 89, 0.45)';
  ctx.fillRect(padX, detailsY, 3, 270);

  const detX = padX + 24;

  // LUGAR
  ctx.fillStyle = '#C5A059';
  ctx.font = '700 16px Montserrat, sans-serif';
  ctx.fillText('LUGAR', detX, detailsY + 24);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 23px Montserrat, sans-serif';
  ctx.fillText('CAPILLA PASEO DEL BUEN PASTOR', detX, detailsY + 56);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.font = '400 17px Montserrat, sans-serif';
  ctx.fillText(
    guest.tableOrSeat
      ? `Córdoba Capital • Ubicación: ${guest.tableOrSeat}`
      : 'Córdoba Capital, Argentina',
    detX,
    detailsY + 84
  );

  // FECHA & HORA
  const dateY = detailsY + 135;
  ctx.fillStyle = '#C5A059';
  ctx.font = '700 16px Montserrat, sans-serif';
  ctx.fillText('FECHA', detX, dateY);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 23px Montserrat, sans-serif';
  ctx.fillText('22 DE OCTUBRE', detX, dateY + 32);

  // Divider between Fecha and Hora
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(detX + 250, dateY - 12, 2, 52);

  ctx.fillStyle = '#C5A059';
  ctx.font = '700 16px Montserrat, sans-serif';
  ctx.fillText('HORA', detX + 280, dateY);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 23px Montserrat, sans-serif';
  ctx.fillText('19:00 HS', detX + 280, dateY + 32);

  // DRESS CODE BADGE
  const badgeY = detailsY + 210;
  ctx.fillStyle = 'rgba(197, 160, 89, 0.12)';
  ctx.fillRect(detX, badgeY, 330, 48);
  ctx.strokeStyle = 'rgba(197, 160, 89, 0.75)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(detX, badgeY, 330, 48);

  ctx.fillStyle = '#E7CF98';
  ctx.font = '700 16px Montserrat, sans-serif';
  ctx.fillText('👔  DRESS CODE: ELEGANTE', detX + 22, badgeY + 30);

  // 4. BOTTOM SECTION: Show en Vivo + Official DIVO Logo + 20 años + Tape Measure
  const footY = H - 235;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, footY);
  ctx.lineTo(W - padX, footY);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(250, 247, 242, 0.85)';
  ctx.font = '600 16px Montserrat, sans-serif';
  ctx.fillText('S H O W   E N   V I V O   —   D E S F I L E   E X C L U S I V O', W / 2, footY + 38);

  // Brand Mark Row
  const customLogo = getCustomLogoUrl();
  const brandCenterY = footY + 100;

  if (customLogo) {
    try {
      const logoImg = await loadImage(customLogo);
      const maxH = 72;
      const maxW = 280;
      const ratio = Math.min(maxW / (logoImg.width || 280), maxH / (logoImg.height || 72));
      const drawW = (logoImg.width || 280) * ratio;
      const drawH = (logoImg.height || 72) * ratio;
      ctx.drawImage(logoImg, W / 2 - drawW - 20, brandCenterY - drawH / 2, drawW, drawH);
    } catch {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 38px Montserrat, sans-serif';
      ctx.fillText('DIVO', W / 2 - 28, brandCenterY);
      ctx.font = '600 12px Montserrat, sans-serif';
      ctx.fillText('TRAJES Y ETIQUETA', W / 2 - 28, brandCenterY + 20);
    }
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 40px Montserrat, sans-serif';
    ctx.fillText('DIVO', W / 2 - 28, brandCenterY + 2);
    ctx.font = '600 12px Montserrat, sans-serif';
    ctx.fillText('TRAJES Y ETIQUETA', W / 2 - 28, brandCenterY + 22);
  }

  // Vertical separator
  ctx.fillStyle = 'rgba(197, 160, 89, 0.5)';
  ctx.fillRect(W / 2 - 4, brandCenterY - 30, 2, 64);

  // "20 años" on the right
  ctx.textAlign = 'left';
  ctx.fillStyle = '#C5A059';
  ctx.font = '700 48px "Old Standard TT", Georgia, serif';
  ctx.fillText('20', W / 2 + 18, brandCenterY + 8);
  ctx.font = 'italic 30px "Old Standard TT", Georgia, serif';
  ctx.fillText('años', W / 2 + 82, brandCenterY + 8);

  // Tailoring Tape Measure Bar at bottom
  const tapeY = footY + 148;
  const tapeW = W - padX * 2;
  ctx.fillStyle = '#D9C498';
  ctx.fillRect(padX, tapeY, tapeW, 18);

  ctx.fillStyle = '#141414';
  for (let i = 0; i <= 50; i++) {
    const tx = padX + (i / 50) * tapeW;
    const tickH = i % 10 === 0 ? 11 : i % 5 === 0 ? 8 : 5;
    ctx.fillRect(tx, tapeY, 1.5, tickH);
  }

  return canvas.toDataURL('image/png', 1.0);
}
