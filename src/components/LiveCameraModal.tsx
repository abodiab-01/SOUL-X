import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, RotateCcw, AlertCircle, Sparkles } from 'lucide-react';
import { Language } from '../types';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  lang: Language;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  lang,
}) => {
  const isAr = lang === 'ar';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Start camera stream when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedPhoto(null);
      setError(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setIsLoading(true);
    setError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(isAr ? 'الكاميرا غير مدعومة في هذا المتصفح' : 'Camera not supported in this browser');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setError(
        err?.message ||
          (isAr
            ? 'تعذر الوصول إلى الكاميرا. يرجى منح إذن الوصول للكاميرا.'
            : 'Unable to access camera. Please allow camera permissions.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if front camera for natural selfie look
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-neutral-800 text-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm">
              {capturedPhoto
                ? isAr
                  ? 'معاينة الصورة الملتقطة'
                  : 'Photo Preview'
                : isAr
                ? 'التصوير المباشر بالكاميرا'
                : 'Live Camera Capture'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Video Area */}
        <div className="relative flex-1 min-h-[320px] sm:min-h-[420px] bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center space-y-3 max-w-xs text-rose-400">
              <AlertCircle className="w-10 h-10 mx-auto opacity-90" />
              <p className="text-xs leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-white text-xs font-bold hover:bg-neutral-700 transition-colors"
              >
                {isAr ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          ) : capturedPhoto ? (
            <img
              src={capturedPhoto}
              alt="Captured"
              className="w-full h-full object-contain max-h-[65vh]"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover max-h-[65vh] ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Viewfinder crosshairs */}
              <div className="absolute inset-8 pointer-events-none border border-white/20 rounded-2xl flex items-center justify-center">
                <div className="w-6 h-6 border-t-2 border-l-2 border-cyan-400 absolute top-0 left-0 rounded-tl-lg" />
                <div className="w-6 h-6 border-t-2 border-r-2 border-cyan-400 absolute top-0 right-0 rounded-tr-lg" />
                <div className="w-6 h-6 border-b-2 border-l-2 border-cyan-400 absolute bottom-0 left-0 rounded-bl-lg" />
                <div className="w-6 h-6 border-b-2 border-r-2 border-cyan-400 absolute bottom-0 right-0 rounded-br-lg" />
              </div>
            </>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-neutral-950/70 flex items-center justify-center">
              <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="p-4 bg-neutral-900 border-t border-neutral-800 flex items-center justify-around gap-3">
          {capturedPhoto ? (
            <div className="w-full flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-3 px-4 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isAr ? 'إعادة الالتقاط' : 'Retake'}</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/30 active:scale-98"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{isAr ? 'استخدام الصورة' : 'Use Photo'}</span>
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between px-6">
              {/* Flip camera */}
              <button
                type="button"
                onClick={toggleCamera}
                className="w-11 h-11 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                title={isAr ? 'تبديل الكاميرا' : 'Flip Camera'}
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* Shutter Button */}
              <button
                type="button"
                onClick={takeSnapshot}
                disabled={isLoading || Boolean(error)}
                className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-lg disabled:opacity-50"
                aria-label={isAr ? 'التقاط' : 'Shutter'}
              >
                <span className="w-12 h-12 rounded-full bg-white hover:bg-cyan-400 transition-colors" />
              </button>

              {/* Spacer / close */}
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title={isAr ? 'إلغاء' : 'Cancel'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
