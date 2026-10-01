import React, { useEffect } from 'react';
import { X, ExternalLink, Youtube, FileText, ArrowRight, Tag } from 'lucide-react';
import { Idea } from '../types';

interface YouTubePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  title: string;
  videoUrl?: string;
  idea?: Idea | null;
  onOpenFullNote?: (ideaId: string) => void;
}

export const YouTubePlayerModal: React.FC<YouTubePlayerModalProps> = ({
  isOpen,
  onClose,
  videoId,
  title,
  videoUrl,
  idea,
  onOpenFullNote,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !videoId) return null;

  const targetUrl = videoUrl || `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-scaleUp">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Youtube className="w-4 h-4 fill-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-400">
                  YouTube Player
                </span>
                {idea && (
                  <span className="text-[11px] text-slate-400 font-medium truncate hidden sm:inline">
                    · IdeaHub 연동 영상
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {title || '유튜브 영상 시청'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="YouTube에서 직접 열기"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">유튜브 원문</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              title="닫기 (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player Container (16:9 responsive) */}
        <div className="relative w-full bg-black aspect-video shrink-0">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>

        {/* Note / Memo Details Panel (Scrollable) */}
        {idea && (
          <div className="p-4 sm:p-5 overflow-y-auto bg-slate-50/80 border-t border-slate-200 flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900">
                  {idea.title}
                </h4>
              </div>

              {onOpenFullNote && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenFullNote(idea.id);
                  }}
                  className="px-3 py-1 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <span>노트 전문 열기</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Note Tags */}
            {idea.tags && idea.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="w-3 h-3 text-slate-400" />
                {idea.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200 font-medium"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Note Content / Memo Excerpt */}
            {idea.content && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans max-h-36 overflow-y-auto whitespace-pre-wrap">
                {idea.content}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
