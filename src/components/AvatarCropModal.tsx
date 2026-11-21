import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Move,
  Crop,
  Upload,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Language } from '../types';

const VIEW_SIZE = 264;
const MAX_OUTPUT_DIMENSION = 512;

export interface CroppedAvatarMeta {
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

interface AvatarCropModalProps {
  isOpen: boolean;
  file: File | null;
  lang: Language;
  isUploading: boolean;
  uploadError: string | null;
  onConfirmCrop: (croppedFile: File, meta: CroppedAvatarMeta) => Promise<void> | void;
  onChooseAnother: () => void;
  onCancel: () => void;
}

function exportCanvasBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  file,
  lang,
  isUploading,
  uploadError,
  onConfirmCrop,
  onChooseAnother,
  onCancel,
}) => {
  const isAr = lang === 'ar';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const pointerDragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    origOffsetX: number;
    origOffsetY: number;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    origOffsetX: 0,
    origOffsetY: 0,
  });

  const [imgDims, setImgDims] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isProcessingCrop, setIsProcessingCrop] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const clampOffset = useCallback(
    (nextX: number, nextY: number, currentZoom: number, dims: { width: number; height: number } | null) => {
      if (!dims) return { x: 0, y: 0 };
      const baseScale = Math.max(VIEW_SIZE / dims.width, VIEW_SIZE / dims.height);
      const scale = baseScale * currentZoom;
      const renderedW = dims.width * scale;
      const renderedH = dims.height * scale;
      const maxX = Math.max(0, (renderedW - VIEW_SIZE) / 2);
      const maxY = Math.max(0, (renderedH - VIEW_SIZE) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, nextX)),
        y: Math.min(maxY, Math.max(-maxY, nextY)),
      };
    },
    []
  );

  // Load selected image file safely
  useEffect(() => {
    if (!isOpen || !file) {
      loadedImageRef.current = null;
      setImgDims(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setLoadError(null);
      return;
    }

    let cancelled = false;
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      if (cancelled) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      loadedImageRef.current = img;
      setImgDims({ width: img.naturalWidth, height: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setLoadError(null);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      if (cancelled) return;
      loadedImageRef.current = null;
      setImgDims(null);
      setLoadError(
        isAr
          ? 'تعذر قراءة الصورة، يرجى اختيار صورة صالحة بصيغة JPEG أو PNG أو WebP'
          : 'Could not load image. Please select a valid JPEG, PNG, or WebP file.'
      );
    };

    img.src = objectUrl;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, file, isAr]);

  // Render interactive 1:1 WYSIWYG crop viewport on canvas (immune to RTL flipping)
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img || !imgDims) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = VIEW_SIZE * dpr;
    canvas.height = VIEW_SIZE * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE);

    const baseScale = Math.max(VIEW_SIZE / imgDims.width, VIEW_SIZE / imgDims.height);
    const scale = baseScale * zoom;
    const renderedW = imgDims.width * scale;
    const renderedH = imgDims.height * scale;
    const clamped = clampOffset(offset.x, offset.y, zoom, imgDims);
    const imgLeft = (VIEW_SIZE - renderedW) / 2 + clamped.x;
    const imgTop = (VIEW_SIZE - renderedH) / 2 + clamped.y;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, imgLeft, imgTop, renderedW, renderedH);

    // Subtle rule-of-thirds guides
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    const third = VIEW_SIZE / 3;
    ctx.beginPath();
    ctx.moveTo(third, 0);
    ctx.lineTo(third, VIEW_SIZE);
    ctx.moveTo(third * 2, 0);
    ctx.lineTo(third * 2, VIEW_SIZE);
    ctx.moveTo(0, third);
    ctx.lineTo(VIEW_SIZE, third);
    ctx.moveTo(0, third * 2);
    ctx.lineTo(VIEW_SIZE, third * 2);
    ctx.stroke();

    // Subtle dark vignette outside circular avatar silhouette so user sees exact circular framing inside 1:1 square
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_SIZE, VIEW_SIZE);
    ctx.arc(VIEW_SIZE / 2, VIEW_SIZE / 2, VIEW_SIZE / 2 - 4, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(10, 12, 18, 0.45)';
    ctx.fill();
    ctx.restore();

    // Crisp circular guide outline
    ctx.beginPath();
    ctx.arc(VIEW_SIZE / 2, VIEW_SIZE / 2, VIEW_SIZE / 2 - 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }, [imgDims, zoom, offset, clampOffset]);

  if (!isOpen || !file) return null;

  const isAlreadySquare = Boolean(imgDims && Math.abs(imgDims.width - imgDims.height) <= 1);
  const busy = isUploading || isProcessingCrop;

  const handleZoomChange = (nextZoomRaw: number) => {
    const nextZoom = Math.min(3, Math.max(1, Number(nextZoomRaw.toFixed(2))));
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, nextZoom, imgDims));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (busy || !imgDims) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origOffsetX: offset.x,
      origOffsetY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerDragRef.current.active || pointerDragRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - pointerDragRef.current.startX;
    const dy = e.clientY - pointerDragRef.current.startY;
    setOffset(
      clampOffset(
        pointerDragRef.current.origOffsetX + dx,
        pointerDragRef.current.origOffsetY + dy,
        zoom,
        imgDims
      )
    );
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerDragRef.current.pointerId === e.pointerId) {
      pointerDragRef.current.active = false;
      pointerDragRef.current.pointerId = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (busy || !imgDims) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.12 : -0.12;
    handleZoomChange(zoom + delta);
  };

  const handleConfirm = async () => {
    const img = loadedImageRef.current;
    if (!img || !imgDims || busy) return;

    setIsProcessingCrop(true);
    try {
      const baseScale = Math.max(VIEW_SIZE / imgDims.width, VIEW_SIZE / imgDims.height);
      const scale = baseScale * zoom;
      const renderedW = imgDims.width * scale;
      const renderedH = imgDims.height * scale;
      const clamped = clampOffset(offset.x, offset.y, zoom, imgDims);
      const imgLeft = (VIEW_SIZE - renderedW) / 2 + clamped.x;
      const imgTop = (VIEW_SIZE - renderedH) / 2 + clamped.y;

      const sSize = Math.min(imgDims.width, imgDims.height, VIEW_SIZE / scale);
      const sx = Math.max(0, Math.min(imgDims.width - sSize, -imgLeft / scale));
      const sy = Math.max(0, Math.min(imgDims.height - sSize, -imgTop / scale));

      const targetSide = Math.max(1, Math.min(MAX_OUTPUT_DIMENSION, Math.round(sSize)));
      const outCanvas = document.createElement('canvas');
      outCanvas.width = targetSide;
      outCanvas.height = targetSide;

      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) {
        throw new Error(isAr ? 'تعذر تجهيز أداة قص الصورة' : 'Canvas context unavailable');
      }

      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(img, sx, sy, sSize, sSize, 0, 0, targetSide, targetSide);

      // Compress cleanly as WebP (or JPEG fallback if browser lacks WebP canvas encoder)
      let blob = await exportCanvasBlob(outCanvas, 'image/webp', 0.84);
      let ext = 'webp';
      if (!blob || (blob.type !== 'image/webp' && blob.type !== 'image/jpeg')) {
        blob = await exportCanvasBlob(outCanvas, 'image/jpeg', 0.85);
        ext = 'jpg';
      } else if (blob.type === 'image/jpeg') {
        ext = 'jpg';
      }

      // If still over 450KB, apply slightly stronger compression
      if (blob && blob.size > 450 * 1024) {
        const tighter = await exportCanvasBlob(outCanvas, blob.type, 0.72);
        if (tighter && tighter.size < blob.size) {
          blob = tighter;
        }
      }

      if (!blob || blob.size === 0) {
        throw new Error(isAr ? 'تعذر ضغط الصورة المختارة' : 'Failed to compress image');
      }

      const croppedFile = new File([blob], `avatar-1x1.${ext}`, {
        type: blob.type || `image/${ext === 'webp' ? 'webp' : 'jpeg'}`,
      });

      await onConfirmCrop(croppedFile, {
        width: targetSide,
        height: targetSide,
        originalSize: file.size,
        compressedSize: croppedFile.size,
      });
    } finally {
      setIsProcessingCrop(false);
    }
  };

  const activeError = loadError || uploadError;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
      onClick={() => !busy && onCancel()}
    >
      <div
        className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="absolute top-4 end-4 p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-40"
          aria-label={isAr ? 'إغلاق' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="space-y-1 pt-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 text-[11px] font-bold">
            <Crop className="w-3.5 h-3.5" />
            <span>
              {isAlreadySquare
                ? isAr
                  ? 'صورة مربعة 1:1 جاهزة'
                  : 'Square 1:1 ready'
                : isAr
                ? 'قص إجباري بنسبة 1:1'
                : 'Required 1:1 square crop'}
            </span>
          </div>

          <h3 className="text-lg font-extrabold text-neutral-900 dark:text-white">
            {isAlreadySquare
              ? isAr
                ? 'ضبط ومعاينة الصورة الشخصية'
                : 'Adjust Profile Picture'
              : isAr
              ? 'قص الصورة لتكون مربعة (1:1)'
              : 'Crop Image to Square (1:1)'}
          </h3>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {isAlreadySquare
              ? isAr
                ? 'يمكنك السحب والتكبير أو التأكيد مباشرة — سيتم ضغطها تلقائياً قبل الحفظ'
                : 'Drag or zoom to adjust. The image will be compressed before saving.'
              : isAr
              ? 'الصورة المختارة غير مربعة، اسحب وحرّك الإطار لاختيار الجزء المربع المناسب (1:1)'
              : 'Selected image is not square. Drag and zoom to crop a 1:1 square.'}
          </p>
        </div>

        {/* Interactive 1:1 Square Cropper Canvas */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="relative w-[264px] h-[264px] rounded-2xl overflow-hidden border-2 border-cyan-500/50 bg-neutral-950 shadow-inner select-none touch-none">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onWheel={handleWheel}
              className={`w-[264px] h-[264px] block touch-none ${
                busy ? 'opacity-60 cursor-wait' : 'cursor-grab active:cursor-grabbing'
              }`}
            />

            {busy && (
              <div className="absolute inset-0 bg-neutral-950/75 flex flex-col items-center justify-center text-white text-xs gap-1.5 z-10">
                <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
                <span className="font-bold">
                  {isAr ? 'جاري ضغط وحفظ الصورة...' : 'Compressing & saving...'}
                </span>
              </div>
            )}
          </div>

          {/* Drag hint & image dimensions */}
          <div className="flex items-center justify-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="inline-flex items-center gap-1">
              <Move className="w-3.5 h-3.5 text-cyan-500" />
              <span>{isAr ? 'اسحب لتحريك الصورة' : 'Drag to reposition'}</span>
            </span>
            {imgDims && (
              <span className="font-mono">
                {imgDims.width}×{imgDims.height} → 1:1
              </span>
            )}
          </div>
        </div>

        {/* Zoom & Center Controls */}
        {imgDims && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-2xl bg-neutral-100/80 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              disabled={busy || zoom <= 1}
              onClick={() => handleZoomChange(zoom - 0.15)}
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 disabled:opacity-40 cursor-pointer transition-colors"
              aria-label={isAr ? 'تصغير' : 'Zoom out'}
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <input
              type="range"
              min={1}
              max={3}
              step={0.02}
              disabled={busy}
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="flex-1 accent-cyan-500 cursor-pointer"
              aria-label={isAr ? 'مستوى التكبير' : 'Zoom level'}
            />

            <button
              type="button"
              disabled={busy || zoom >= 3}
              onClick={() => handleZoomChange(zoom + 0.15)}
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 disabled:opacity-40 cursor-pointer transition-colors"
              aria-label={isAr ? 'تكبير' : 'Zoom in'}
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              title={isAr ? 'إعادة ضبط التمركز' : 'Reset'}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-white dark:hover:bg-neutral-700 disabled:opacity-40 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Display */}
        {activeError && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2 text-start">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{activeError}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            disabled={busy || !imgDims || Boolean(loadError)}
            onClick={handleConfirm}
            className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs sm:text-sm shadow-lg transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isAr ? 'جاري الضغط والحفظ...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>
                  {isAlreadySquare
                    ? isAr
                      ? 'ضغط وحفظ الصورة (1:1)'
                      : 'Compress & Save (1:1)'
                    : isAr
                    ? 'قص الصورة 1:1 وحفظها'
                    : 'Crop 1:1 & Save'}
                </span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onChooseAnother}
              className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAr ? 'اختيار صورة أخرى' : 'Choose another'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
