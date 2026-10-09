import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { generateQRDataUrl } from '../../utils/qrCardRenderer';
import {
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Download,
  Share2,
  Tv,
  Camera,
  ExternalLink,
  Shield,
  FileSpreadsheet,
  Archive,
  RefreshCw,
  Eye,
  Sliders,
  Sparkles,
  Search,
  Filter
} from 'lucide-react';
import { LiveWallService } from '../../services/liveWallService';
import { LiveEventConfig, LivePost, PostStatus } from '../../types/liveWall';
import { DivoLogo } from '../brand/DivoLogo';

interface LiveWallAdminProps {
  onOpenProjectionScreen: () => void;
  onOpenGuestUpload: () => void;
}

export const LiveWallAdmin: React.FC<LiveWallAdminProps> = ({
  onOpenProjectionScreen,
  onOpenGuestUpload,
}) => {
  const [posts, setPosts] = useState<LivePost[]>(LiveWallService.getPosts());
  const [config, setConfig] = useState<LiveEventConfig>(LiveWallService.getEventConfig());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [qrModalUrl, setQrModalUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  useEffect(() => {
    const unsubPosts = LiveWallService.subscribePosts((p) => setPosts(p));
    const unsubConfig = LiveWallService.subscribeConfig((c) => setConfig(c));
    return () => {
      unsubPosts();
      unsubConfig();
    };
  }, []);

  const guestUploadUrl = LiveWallService.getGuestUploadUrl(config.slug);

  // Generar QR en alta resolución para el modal y descarga
  const handleOpenQrModal = async () => {
    try {
      const url = await generateQRDataUrl(guestUploadUrl, 1024, 2);
      setQrModalUrl(url);
      setShowQrModal(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadQrImage = () => {
    if (!qrModalUrl) return;
    const a = document.createElement('a');
    a.href = qrModalUrl;
    a.download = `QR-Alta-Resolucion-Muro-DIVO-20-Anos.png`;
    a.click();
  };

  const handleStatusChange = (postId: string, nuevoEstado: PostStatus) => {
    LiveWallService.updatePostStatus(postId, nuevoEstado);
  };

  const handleDelete = (postId: string) => {
    if (window.confirm('¿Querés eliminar esta publicación definitivamente?')) {
      LiveWallService.deletePost(postId);
    }
  };

  const handleToggleModeration = () => {
    const nextVal = !config.moderacionActiva;
    LiveWallService.updateEventConfig({ moderacionActiva: nextVal });
  };

  // Descarga de galería completa en archivo ZIP usando JSZip y FileSaver
  const handleDownloadZipGallery = async () => {
    const postsWithImages = posts.filter((p) => p.imageUrl);
    if (postsWithImages.length === 0) {
      alert('No hay fotos cargadas aún para exportar en ZIP.');
      return;
    }

    try {
      setIsExportingZip(true);
      const zip = new JSZip();
      const folder = zip.folder('galeria-divo-20-anos');

      for (let i = 0; i < postsWithImages.length; i++) {
        const post = postsWithImages[i];
        if (!post.imageUrl) continue;

        let blob: Blob;
        if (post.imageUrl.startsWith('data:')) {
          // Base64 image
          const base64Content = post.imageUrl.split(',')[1];
          const mime = post.imageUrl.split(';')[0].split(':')[1] || 'image/jpeg';
          folder?.file(
            `foto-${i + 1}-${post.nombreInvitado.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`,
            base64Content,
            { base64: true }
          );
        } else {
          // URL remota
          try {
            const res = await fetch(post.imageUrl);
            blob = await res.blob();
            folder?.file(
              `foto-${i + 1}-${post.nombreInvitado.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`,
              blob
            );
          } catch (e) {
            console.warn('Error fetching remote photo for zip', e);
          }
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Galeria-Completa-DIVO-20-Anos-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (err) {
      console.error('Error generating zip', err);
      alert('Hubo un problema al generar el archivo ZIP.');
    } finally {
      setIsExportingZip(false);
    }
  };

  // Descarga de mensajes y dedicatorias en archivo CSV
  const handleDownloadCsvMessages = () => {
    const headers = ['ID', 'Nombre Invitado', 'Mensaje', 'Tiene Foto', 'Estado', 'Fecha y Hora'];
    const rows = posts.map((p) => [
      `"${p.id}"`,
      `"${p.nombreInvitado}"`,
      `"${(p.mensaje || '').replace(/"/g, '""')}"`,
      p.imageUrl ? 'SÍ' : 'NO',
      `"${p.estado}"`,
      `"${p.createdAt}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `Mensajes-Dedicatorias-DIVO-20-Anos-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // Filtrado
  const filteredPosts = posts.filter((p) => {
    if (statusFilter === 'all') return true;
    return p.estado === statusFilter;
  });

  const pendingCount = posts.filter((p) => p.estado === 'pendiente').length;
  const approvedCount = posts.filter((p) => p.estado === 'aprobado').length;
  const rejectedCount = posts.filter((p) => p.estado === 'rechazado').length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 text-[#FAF7F2]">
      {/* Top Banner & Quick Controls */}
      <div className="bg-[#121212] border border-[#C5A059]/40 p-4 sm:p-6 mb-6 rounded-sm shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-montserrat text-[10px] tracking-[0.25em] text-[#C5A059] uppercase font-bold">
              MODERACIÓN Y CONTROL EN TIEMPO REAL
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <h2 className="font-montserrat text-xl sm:text-2xl font-bold text-white mt-1">
            Muro de Fotos en Vivo • DIVO 20 Años
          </h2>
          <p className="font-montserrat text-xs text-white/60 mt-1">
            Los invitados escanean el QR desde la pantalla o mesa y suben sus fotos desde el celular.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Botón Pantalla Gigante */}
          <button
            onClick={onOpenProjectionScreen}
            className="px-3.5 py-2 bg-[#C5A059] hover:bg-[#E7CF98] text-black font-montserrat text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer shadow-md"
            title="Abrir vista de proyector"
          >
            <Tv className="w-4 h-4" />
            <span>Pantalla Gigante</span>
          </button>

          {/* Botón QR Alta Resolución */}
          <button
            onClick={handleOpenQrModal}
            className="px-3 py-2 bg-[#1f1f1f] hover:bg-[#2d2d2d] text-white border border-[#C5A059]/40 font-montserrat text-xs font-semibold tracking-wider uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[#C5A059]" />
            <span>QR para Imprimir</span>
          </button>

          {/* Botón Probar como invitado */}
          <button
            onClick={onOpenGuestUpload}
            className="px-3 py-2 bg-[#1f1f1f] hover:bg-[#2d2d2d] text-white border border-white/20 font-montserrat text-xs font-semibold tracking-wider uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-[#C5A059]" />
            <span>Subir como Invitado</span>
          </button>
        </div>
      </div>

      {/* Moderation Switch & Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Toggle Moderación */}
        <div className="bg-[#141414] border border-[#C5A059]/30 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-montserrat text-[10px] tracking-wider text-[#C5A059] uppercase font-bold">
              Filtro de Moderación
            </span>
            <Shield className="w-4 h-4 text-[#C5A059]" />
          </div>
          <div className="my-2">
            <div className="text-xs text-white/80">
              {config.moderacionActiva
                ? 'Activo (Debés aprobar las fotos antes de proyectar)'
                : 'Directo (Las fotos van directo a la pantalla)'}
            </div>
          </div>
          <button
            onClick={handleToggleModeration}
            className={`w-full py-1.5 px-3 text-xs font-montserrat tracking-wider uppercase font-bold transition-colors cursor-pointer ${
              config.moderacionActiva
                ? 'bg-amber-500 text-black'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {config.moderacionActiva ? 'Desactivar Filtro' : 'Activar Moderación'}
          </button>
        </div>

        {/* Pendientes */}
        <div
          onClick={() => setStatusFilter('pendiente')}
          className={`bg-[#141414] border p-4 cursor-pointer transition-colors ${
            statusFilter === 'pendiente' ? 'border-amber-400 bg-amber-950/20' : 'border-white/10 hover:border-white/30'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-montserrat uppercase tracking-wider text-amber-400 font-bold">
            <span>Pendientes de Aprobación</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black font-montserrat text-amber-400 mt-2">
            {pendingCount}
          </div>
          <span className="text-[10px] text-white/40 mt-1 block">Requieren revisión rápida</span>
        </div>

        {/* Aprobadas */}
        <div
          onClick={() => setStatusFilter('aprobado')}
          className={`bg-[#141414] border p-4 cursor-pointer transition-colors ${
            statusFilter === 'aprobado' ? 'border-emerald-500 bg-emerald-950/20' : 'border-white/10 hover:border-white/30'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-montserrat uppercase tracking-wider text-emerald-400 font-bold">
            <span>En Pantalla (Aprobadas)</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black font-montserrat text-emerald-400 mt-2">
            {approvedCount}
          </div>
          <span className="text-[10px] text-white/40 mt-1 block">Proyectándose en el escenario</span>
        </div>

        {/* Export Toolbar */}
        <div className="bg-[#141414] border border-white/10 p-4 flex flex-col justify-between">
          <span className="font-montserrat text-[10px] tracking-wider text-[#C5A059] uppercase font-bold">
            Descargas del Evento
          </span>
          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={handleDownloadZipGallery}
              disabled={isExportingZip}
              className="py-1.5 px-3 bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-montserrat text-white tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>{isExportingZip ? 'Generando ZIP...' : 'Descargar ZIP (Fotos)'}</span>
            </button>
            <button
              onClick={handleDownloadCsvMessages}
              className="py-1.5 px-3 bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-montserrat text-white tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar CSV (Mensajes)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/10">
        {[
          { id: 'all', label: `Todas (${posts.length})` },
          { id: 'pendiente', label: `Pendientes (${pendingCount})` },
          { id: 'aprobado', label: `Aprobadas (${approvedCount})` },
          { id: 'rechazado', label: `Rechazadas (${rejectedCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`py-1.5 px-3 text-xs font-montserrat uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
              statusFilter === tab.id
                ? 'bg-[#C5A059] text-black'
                : 'bg-[#1a1a1a] text-white/70 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Posts Moderation Grid */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-16 bg-[#121212] border border-white/10 rounded-sm text-white/50 text-xs">
          No hay publicaciones en esta categoría.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className={`bg-[#141414] border rounded-sm overflow-hidden flex flex-col justify-between transition-all shadow-md ${
                post.estado === 'pendiente'
                  ? 'border-amber-500/80 shadow-amber-900/10'
                  : post.estado === 'aprobado'
                  ? 'border-emerald-500/40'
                  : 'border-rose-500/40 opacity-70'
              }`}
            >
              {/* Photo or text block */}
              {post.imageUrl ? (
                <div className="relative aspect-square bg-black overflow-hidden group">
                  <img
                    src={post.imageUrl}
                    alt={post.nombreInvitado}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <span
                      className={`text-[9px] font-montserrat uppercase font-bold px-2 py-0.5 rounded-none shadow-md ${
                        post.estado === 'aprobado'
                          ? 'bg-emerald-600 text-white'
                          : post.estado === 'pendiente'
                          ? 'bg-amber-500 text-black'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {post.estado}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gradient-to-br from-[#1a1813] to-[#121212] min-h-[140px] flex flex-col justify-between">
                  <span className="text-[9px] font-mono text-[#C5A059] uppercase tracking-wider">
                    Tarjeta solo texto
                  </span>
                  <p className="font-old-standard italic text-sm text-[#E7CF98]">
                    "{post.mensaje}"
                  </p>
                  <span
                    className={`text-[9px] font-montserrat uppercase font-bold px-1.5 py-0.5 w-fit ${
                      post.estado === 'aprobado'
                        ? 'bg-emerald-600 text-white'
                        : post.estado === 'pendiente'
                        ? 'bg-amber-500 text-black'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {post.estado}
                  </span>
                </div>
              )}

              {/* Info & Caption */}
              <div className="p-3 bg-[#111111] border-t border-white/5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="font-montserrat font-bold text-white text-xs">
                    {post.nombreInvitado}
                  </div>
                  {post.mensaje && post.imageUrl && (
                    <p className="font-montserrat text-[11px] text-white/70 mt-1 line-clamp-2">
                      "{post.mensaje}"
                    </p>
                  )}
                  <div className="text-[9px] font-mono text-white/40 mt-1">
                    {new Date(post.createdAt).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    hs
                  </div>
                </div>

                {/* Moderation Action Buttons (Optimized for quick mobile tap) */}
                <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between gap-1">
                  {post.estado !== 'aprobado' && (
                    <button
                      onClick={() => handleStatusChange(post.id, 'aprobado')}
                      className="flex-1 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-[11px] font-montserrat uppercase font-bold tracking-wider rounded-sm flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="Aprobar para salir en pantalla grande"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Aprobar</span>
                    </button>
                  )}

                  {post.estado !== 'rechazado' && (
                    <button
                      onClick={() => handleStatusChange(post.id, 'rechazado')}
                      className="py-1.5 px-2 bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[11px] font-montserrat uppercase font-semibold transition-colors cursor-pointer"
                      title="Rechazar foto"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(post.id)}
                    className="p-1.5 text-white/40 hover:text-rose-400 hover:bg-white/5 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR MODAL PARA DESCARGA EN ALTA RESOLUCIÓN */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border-2 border-[#C5A059] p-6 max-w-sm w-full text-center rounded-sm shadow-2xl relative">
            <h3 className="font-montserrat text-lg font-bold text-white">
              Código QR en Alta Resolución
            </h3>
            <p className="font-montserrat text-xs text-white/60 mt-1">
              Imprimilo para colocar en mesas, tótems de entrada o folletería del evento.
            </p>

            <div className="my-6 p-4 bg-white rounded-sm inline-block shadow-inner">
              <img src={qrModalUrl} alt="QR Muro en vivo" className="w-56 h-56 block mx-auto" />
            </div>

            <div className="space-y-2">
              <button
                onClick={handleDownloadQrImage}
                className="w-full py-2.5 bg-[#C5A059] hover:bg-[#E7CF98] text-black font-montserrat text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Imagen PNG</span>
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-white font-montserrat text-xs tracking-wider transition-colors cursor-pointer"
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
