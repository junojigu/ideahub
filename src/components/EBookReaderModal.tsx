import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, Calendar, Eye, Star, PenSquare, Trash2, X, ExternalLink, 
  Book, FileText, Lightbulb, ChevronLeft, ChevronRight, Layers, 
  ListOrdered, ScrollText, ArrowRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Idea } from '../types';
import { formatDate } from '../utils/dateUtils';
import { renderHighlightedText } from '../utils/highlightUtils';
import { normalizeMarkdown } from '../utils/markdownUtils';
import { cleanSourceTitle, extractMainBookTitle, getSourceType } from '../utils/sourceUtils';
import { ConfirmModal } from './ConfirmModal';

interface EBookReaderModalProps {
  idea: Idea | null;
  isOpen: boolean;
  onClose: () => void;
  onStartEdit: (ideaId: string) => void;
  onDelete: (ideaId: string) => void;
  onSelectTag: (tag: string) => void;
  searchQuery?: string;
  allIdeas?: Idea[];
  initialContinuousMode?: boolean;
  onOpenMergeModal?: (ideas: Idea[]) => void;
}

export const EBookReaderModal: React.FC<EBookReaderModalProps> = ({
  idea,
  isOpen,
  onClose,
  onStartEdit,
  onDelete,
  onSelectTag,
  searchQuery = '',
  allIdeas = [],
  initialContinuousMode = false,
  onOpenMergeModal,
}) => {
  const [fontSize, setFontSize] = useState(17); // base 17px
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(initialContinuousMode);
  const [continuousViewType, setContinuousViewType] = useState<'scroll' | 'slide'>('scroll');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Find all ideas from same source
  const sameSourceIdeas = useMemo(() => {
    if (!idea || !idea.sourceUrl || !allIdeas || allIdeas.length === 0) {
      return idea ? [idea] : [];
    }

    const targetBook = extractMainBookTitle(idea.sourceUrl).toLowerCase();
    const targetClean = cleanSourceTitle(idea.sourceUrl).toLowerCase();
    if (!targetBook && !targetClean) return [idea];

    const matched = allIdeas.filter((i) => {
      const b = extractMainBookTitle(i.sourceUrl).toLowerCase();
      const c = cleanSourceTitle(i.sourceUrl).toLowerCase();
      return b === targetBook || c === targetClean || (targetBook && (b.includes(targetBook) || targetBook.includes(b)));
    });

    // Sort ideas chronologically by date, then title
    return matched.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.title || '').localeCompare(b.title || '', 'ko');
    });
  }, [idea, allIdeas]);

  // Sync current slide index when idea or sameSourceIdeas changes
  useEffect(() => {
    if (idea && sameSourceIdeas.length > 0) {
      const idx = sameSourceIdeas.findIndex((i) => i.id === idea.id);
      setCurrentSlideIndex(idx >= 0 ? idx : 0);
    }
  }, [idea, sameSourceIdeas]);

  // Sync continuous mode on open
  useEffect(() => {
    if (isOpen) {
      if (initialContinuousMode && sameSourceIdeas.length > 1) {
        setIsContinuousMode(true);
      } else {
        setIsContinuousMode(false);
      }
    }
  }, [isOpen, initialContinuousMode, sameSourceIdeas.length]);

  // Keyboard navigation for slide mode (ArrowLeft / ArrowRight)
  useEffect(() => {
    if (!isOpen || !isContinuousMode || continuousViewType !== 'slide') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentSlideIndex((prev) => Math.min(sameSourceIdeas.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isContinuousMode, continuousViewType, sameSourceIdeas.length]);

  if (!isOpen || !idea) return null;

  // Active idea depending on mode
  const activeIdea = isContinuousMode && continuousViewType === 'slide' && sameSourceIdeas[currentSlideIndex]
    ? sameSourceIdeas[currentSlideIndex]
    : idea;

  const plainText = (activeIdea.content || '').replace(/<[^>]*>/g, '').trim();
  const charCount = plainText.length;
  const estMinutes = Math.max(1, Math.ceil(charCount / 400));

  // Total stats for all ideas in continuous scroll mode
  const totalChars = sameSourceIdeas.reduce((acc, curr) => acc + (curr.content || '').length, 0);
  const totalEstMinutes = Math.max(1, Math.ceil(totalChars / 400));

  const adjustFontSize = (delta: number) => {
    setFontSize((prev) => Math.min(24, Math.max(14, prev + delta)));
  };

  const renderSourceBadge = (sourceStr?: string) => {
    if (!sourceStr) return null;
    const clean = cleanSourceTitle(sourceStr);
    if (!clean) return null;

    const type = getSourceType(sourceStr);

    if (type === 'link') {
      const href = clean.startsWith('www.') ? `https://${clean}` : clean;
      return (
        <a
          href={href.startsWith('http') ? href : `https://${href}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>{clean}</span>
        </a>
      );
    }

    if (type === 'book') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
          <Book className="w-3.5 h-3.5 text-amber-600" />
          <span>{clean}</span>
        </span>
      );
    }

    if (type === 'general') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
          <FileText className="w-3.5 h-3.5 text-emerald-600" />
          <span>{clean}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200">
        <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />
        <span>{clean}</span>
      </span>
    );
  };

  // Helper to highlight tags and search terms in React Markdown text nodes
  const tagsToHighlight = (activeIdea.tags || []).filter((t) => t && t !== '일반');

  const renderTextWithHighlights = (nodeChildren: React.ReactNode): React.ReactNode => {
    if (typeof nodeChildren === 'string') {
      if (searchQuery && searchQuery.trim()) {
        const queryTerms = searchQuery.trim().split(/\s+/).filter(Boolean);
        const queryPattern = queryTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const queryRegex = new RegExp(`(${queryPattern})`, 'gi');
        const queryParts = nodeChildren.split(queryRegex);

        if (queryParts.length > 1) {
          return queryParts.map((qPart, i) => {
            const isMatch = queryTerms.some((t) => t.toLowerCase() === qPart.toLowerCase());
            if (isMatch) {
              return (
                <mark key={i} className="bg-amber-100/90 text-slate-900 font-semibold p-0 m-0 border-none inline">
                  {qPart}
                </mark>
              );
            }
            return renderTagMatches(qPart);
          });
        }
      }

      return renderTagMatches(nodeChildren);
    }

    if (Array.isArray(nodeChildren)) {
      return nodeChildren.map((child, idx) => (
        <React.Fragment key={idx}>{renderTextWithHighlights(child)}</React.Fragment>
      ));
    }

    return nodeChildren;
  };

  const renderTagMatches = (textStr: string): React.ReactNode => {
    if (!textStr) return textStr;

    if (!tagsToHighlight || tagsToHighlight.length === 0) {
      return renderNumberMarkers(textStr);
    }

    const validTags = tagsToHighlight
      .map((t) => t.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (validTags.length === 0) {
      return renderNumberMarkers(textStr);
    }

    const pattern = validTags.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = textStr.split(regex);

    if (parts.length === 1) {
      return renderNumberMarkers(textStr);
    }

    return parts.map((part, i) => {
      const isTagMatch = validTags.some((t) => t.toLowerCase() === part.toLowerCase());
      if (isTagMatch) {
        return (
          <span
            key={i}
            className="underline decoration-dotted decoration-amber-600 underline-offset-4 font-semibold text-stone-900 bg-transparent"
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={i}>{renderNumberMarkers(part)}</React.Fragment>;
    });
  };

  const renderNumberMarkers = (textStr: string): React.ReactNode => {
    if (!textStr) return textStr;

    const combinedRegex = /(==(.*?)==)|((?:^|\s)(?:\d+[\.\)]|\(\d+\)|\[\d+\]|[①-⑩])(?:\s+|$))/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = combinedRegex.exec(textStr)) !== null) {
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        parts.push(textStr.substring(lastIndex, matchIndex));
      }

      if (match[1]) {
        const highlightText = match[2];
        parts.push(
          <mark key={`hl-${matchIndex}`} className="bg-amber-200/90 text-stone-900 font-semibold px-1 py-0.5 rounded-xs m-0 inline">
            {highlightText}
          </mark>
        );
      } else if (match[3]) {
        const rawMarker = match[3];
        parts.push(
          <strong key={`marker-${matchIndex}`} className="font-black text-stone-950 inline-block px-0.5">
            {rawMarker}
          </strong>
        );
      }

      lastIndex = combinedRegex.lastIndex;
    }

    if (lastIndex < textStr.length) {
      parts.push(textStr.substring(lastIndex));
    }

    if (parts.length === 0) return textStr;

    return (
      <>
        {parts.map((p, idx) => (
          <React.Fragment key={idx}>{p}</React.Fragment>
        ))}
      </>
    );
  };

  const markdownComponents = {
    p: ({ children }: any) => <p className="mb-4 leading-relaxed font-normal">{renderTextWithHighlights(children)}</p>,
    li: ({ children }: any) => <li className="mb-1.5 leading-relaxed font-normal">{renderTextWithHighlights(children)}</li>,
    ol: ({ children }: any) => <ol className="list-decimal list-inside space-y-1.5 my-3 font-semibold text-stone-900">{children}</ol>,
    ul: ({ children }: any) => <ul className="list-disc list-inside space-y-1.5 my-3">{children}</ul>,
    h1: ({ children }: any) => <h1 className="text-2xl font-black text-stone-900 mt-6 mb-3 border-b border-stone-200 pb-1.5">{renderTextWithHighlights(children)}</h1>,
    h2: ({ children }: any) => <h2 className="text-xl font-extrabold text-stone-900 mt-5 mb-2.5">{renderTextWithHighlights(children)}</h2>,
    h3: ({ children }: any) => <h3 className="text-lg font-bold text-stone-900 mt-4 mb-2">{renderTextWithHighlights(children)}</h3>,
    h4: ({ children }: any) => <h4 className="text-base font-bold text-stone-900 mt-3 mb-1.5">{renderTextWithHighlights(children)}</h4>,
    blockquote: ({ children }: any) => (
      <blockquote className="my-4 border-l-4 border-amber-500 pl-4 py-1.5 bg-amber-50/50 text-stone-700 italic rounded-r-lg">
        {renderTextWithHighlights(children)}
      </blockquote>
    ),
    code: ({ className, children, ...props }: any) => {
      const isInline = !className && typeof children === 'string' && !children.includes('\n');
      if (isInline) {
        return (
          <code className="bg-stone-100 text-stone-800 px-1.5 py-0.5 rounded text-xs font-mono border border-stone-200 font-semibold" {...props}>
            {children}
          </code>
        );
      }
      return (
        <pre className="my-3 p-3 bg-stone-900 text-stone-100 rounded-xl overflow-x-auto text-xs font-mono leading-normal border border-stone-800">
          <code {...props}>{children}</code>
        </pre>
      );
    },
    hr: () => <hr className="my-6 border-stone-200" />,
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4 border border-stone-200 rounded-xl">
        <table className="min-w-full divide-y divide-stone-200 text-xs">{children}</table>
      </div>
    ),
    th: ({ children }: any) => <th className="bg-stone-100 px-3 py-2 text-left font-bold text-stone-900">{children}</th>,
    td: ({ children }: any) => <td className="px-3 py-2 border-t border-stone-100 text-stone-700">{children}</td>,
    a: ({ href, children }: any) => (
      <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">
        {children}
      </a>
    ),
  };

  const scrollToSection = (secId: string) => {
    const el = document.getElementById(secId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleMergeSameSource = () => {
    if (onOpenMergeModal && sameSourceIdeas.length > 0) {
      onClose();
      onOpenMergeModal(sameSourceIdeas);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-5 font-sans"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-stone-200 flex flex-col max-h-[94vh] overflow-hidden transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Reader Top Bar */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-stone-200/80 bg-[#faf9f6] flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
            
            {/* Left: Mode toggle & Source */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-stone-800 text-xs font-bold">
                <BookOpen className="w-4 h-4 text-amber-700" />
                <span>전자책 읽기</span>
              </div>

              {sameSourceIdeas.length > 1 && (
                <div className="flex items-center bg-stone-200/80 rounded-xl p-0.5 text-xs font-bold">
                  <button
                    onClick={() => setIsContinuousMode(false)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      !isContinuousMode ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    단일 메모
                  </button>
                  <button
                    onClick={() => setIsContinuousMode(true)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                      isContinuousMode ? 'bg-amber-600 text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Book className="w-3.5 h-3.5" />
                    <span>📚 도서 연속 읽기 ({sameSourceIdeas.length}편)</span>
                  </button>
                </div>
              )}

              {/* Sub-view toggle for continuous mode */}
              {isContinuousMode && sameSourceIdeas.length > 1 && (
                <div className="flex items-center bg-stone-100 rounded-lg p-0.5 text-xs font-bold border border-stone-200">
                  <button
                    onClick={() => setContinuousViewType('scroll')}
                    title="한 페이지에 쭉 이어보기"
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                      continuousViewType === 'scroll' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ScrollText className="w-3 h-3" />
                    <span>전체 스크롤</span>
                  </button>
                  <button
                    onClick={() => setContinuousViewType('slide')}
                    title="한 편씩 책장 넘기며 보기"
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                      continuousViewType === 'slide' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ListOrdered className="w-3 h-3" />
                    <span>책장 넘김</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right: Tools & Close */}
            <div className="flex items-center gap-2">
              {/* Merge button when multiple notes share source */}
              {sameSourceIdeas.length > 1 && onOpenMergeModal && (
                <button
                  onClick={handleMergeSameSource}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                  title="이 출처의 모든 메모 하나로 결합"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>통합하기 ({sameSourceIdeas.length})</span>
                </button>
              )}

              {/* Font Size Adjuster */}
              <div className="flex items-center bg-stone-200/60 rounded-lg p-0.5 text-stone-700 font-bold text-xs">
                <button
                  onClick={() => adjustFontSize(-1)}
                  className="px-2 py-1 hover:bg-white rounded transition-colors cursor-pointer"
                  title="글자 작게"
                >
                  A-
                </button>
                <span className="w-px h-3 bg-stone-300"></span>
                <button
                  onClick={() => adjustFontSize(1)}
                  className="px-2 py-1 hover:bg-white rounded transition-colors cursor-pointer"
                  title="글자 크게"
                >
                  A+
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer font-bold text-lg"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Reader Body Container */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto bg-[#fdfbf7] p-5 sm:p-8 md:p-10 flex flex-col justify-between"
          >
            {/* Case A: Continuous Scroll Mode (연속 스크롤 독서 뷰) */}
            {isContinuousMode && continuousViewType === 'scroll' && sameSourceIdeas.length > 1 ? (
              <div className="space-y-10">
                
                {/* Book Header Banner */}
                <div className="bg-amber-100/60 border border-amber-200/80 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
                    <Book className="w-4 h-4 text-amber-700" />
                    <span>도서 전편 연속 독서</span>
                    <span className="text-amber-400">•</span>
                    <span>총 {sameSourceIdeas.length}편의 메모</span>
                    <span className="text-amber-400">•</span>
                    <span>{totalChars.toLocaleString()}자 (약 {totalEstMinutes}분 독서)</span>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-black text-amber-950 font-sans tracking-tight">
                    📚 {extractMainBookTitle(idea.sourceUrl) || idea.title}
                  </h1>

                  {/* Table of Contents Quick Jump Pills */}
                  <div className="pt-2 border-t border-amber-200/60 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-black text-amber-900 mr-1">목차 바로가기:</span>
                    {sameSourceIdeas.map((secIdea, sIdx) => (
                      <button
                        key={secIdea.id}
                        onClick={() => scrollToSection(`chapter-sec-${secIdea.id}`)}
                        className="px-2.5 py-1 text-xs font-bold bg-white/90 hover:bg-white text-stone-800 hover:text-blue-700 rounded-lg border border-amber-200/80 shadow-2xs transition-all cursor-pointer"
                      >
                        #{sIdx + 1}. {secIdea.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* All Chapters Sequentially */}
                <div className="space-y-12">
                  {sameSourceIdeas.map((chapIdea, cIdx) => (
                    <section
                      key={chapIdea.id}
                      id={`chapter-sec-${chapIdea.id}`}
                      className="pt-6 border-t-2 border-stone-200/80 first:border-t-0 first:pt-0"
                    >
                      {/* Chapter Title & Meta */}
                      <div className="mb-5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-200/80 text-amber-900 border border-amber-300">
                            제 {cIdx + 1} 장 / 총 {sameSourceIdeas.length}편
                          </span>
                          <span className="text-xs text-stone-400 font-semibold">
                            {formatDate(chapIdea.date)}
                          </span>
                        </div>

                        <h2 className="text-xl sm:text-2xl font-black text-stone-900 leading-snug">
                          {cIdx + 1}. {chapIdea.title}
                        </h2>
                      </div>

                      {/* Chapter Content */}
                      <div
                        style={{ fontSize: `${fontSize}px` }}
                        className="text-stone-800 leading-[1.85] font-sans"
                      >
                        <div className="markdown-body">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkBreaks]}
                            components={markdownComponents}
                          >
                            {normalizeMarkdown(chapIdea.content || '본문 내용이 비어있습니다.')}
                          </ReactMarkdown>
                        </div>
                      </div>

                      {/* Chapter Tags */}
                      {chapIdea.tags && chapIdea.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-4">
                          {chapIdea.tags.map((t, tidx) => (
                            <span key={tidx} className="text-xs text-stone-500 font-medium">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>

              </div>
            ) : (
              /* Case B: Single Note OR Slide Mode */
              <div className="space-y-6">
                
                {/* Slide progress header if in slide mode */}
                {isContinuousMode && continuousViewType === 'slide' && sameSourceIdeas.length > 1 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs font-bold text-amber-900">
                    <div className="flex items-center gap-2">
                      <Book className="w-4 h-4 text-amber-700" />
                      <span>
                        제 {currentSlideIndex + 1} 편 / 총 {sameSourceIdeas.length}편
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                        disabled={currentSlideIndex === 0}
                        className="px-2 py-1 bg-white hover:bg-amber-100 rounded-lg border border-amber-300 disabled:opacity-30 cursor-pointer flex items-center gap-0.5"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>이전</span>
                      </button>
                      <button
                        onClick={() => setCurrentSlideIndex((prev) => Math.min(sameSourceIdeas.length - 1, prev + 1))}
                        disabled={currentSlideIndex === sameSourceIdeas.length - 1}
                        className="px-2 py-1 bg-white hover:bg-amber-100 rounded-lg border border-amber-300 disabled:opacity-30 cursor-pointer flex items-center gap-0.5"
                      >
                        <span>다음</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Title & Metadata */}
                <div className="border-b border-stone-200/80 pb-5">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-stone-900 leading-snug tracking-tight font-sans">
                    {renderHighlightedText(activeIdea.title, searchQuery)}
                  </h2>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      <span>{formatDate(activeIdea.date)}</span>
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="flex items-center gap-1.5 text-stone-600">
                      <Eye className="w-3.5 h-3.5 text-stone-400" />
                      <span>조회 {activeIdea.views || 1}회</span>
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="flex items-center gap-1">
                      <span className="text-stone-400">중요도:</span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: activeIdea.importance || 1 }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        ))}
                      </div>
                    </span>
                    <span className="text-stone-300">•</span>
                    <span>약 {estMinutes}분 독서 ({charCount.toLocaleString()}자)</span>
                  </div>
                </div>

                {/* Reading Text Surface with Tag & Search Highlights */}
                <div
                  style={{ fontSize: `${fontSize}px` }}
                  className="text-stone-800 leading-[1.85] tracking-normal font-sans min-h-[220px]"
                >
                  <div className="markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={markdownComponents}
                    >
                      {normalizeMarkdown(activeIdea.content || '본문 내용이 비어있습니다.')}
                    </ReactMarkdown>
                  </div>
                </div>

              </div>
            )}

            {/* Bottom Section: Navigation & Actions */}
            <div className="mt-10 pt-6 border-t border-stone-200/80 space-y-4">
              
              {/* Slide Mode Prev/Next Nav Controls */}
              {isContinuousMode && continuousViewType === 'slide' && sameSourceIdeas.length > 1 && (
                <div className="flex items-center justify-between p-3 bg-amber-50/70 border border-amber-200 rounded-2xl">
                  <button
                    onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentSlideIndex === 0}
                    className="px-3.5 py-2 bg-white hover:bg-amber-100 text-amber-950 font-bold text-xs rounded-xl border border-amber-200 disabled:opacity-30 cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>이전 메모 (←)</span>
                  </button>

                  <div className="text-xs font-bold text-amber-900">
                    {currentSlideIndex + 1} / {sameSourceIdeas.length} 편
                  </div>

                  <button
                    onClick={() => setCurrentSlideIndex((prev) => Math.min(sameSourceIdeas.length - 1, prev + 1))}
                    disabled={currentSlideIndex === sameSourceIdeas.length - 1}
                    className="px-3.5 py-2 bg-white hover:bg-amber-100 text-amber-950 font-bold text-xs rounded-xl border border-amber-200 disabled:opacity-30 cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    <span>다음 메모 (→)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Source badge */}
              {activeIdea.sourceUrl && (
                <div>
                  <div className="text-xs font-semibold text-stone-400 mb-1.5">출처 및 참고 도서</div>
                  {renderSourceBadge(activeIdea.sourceUrl)}
                </div>
              )}

              {/* Tags & Action Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-amber-900">연관 태그:</span>
                  {(activeIdea.tags || []).map((t, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onSelectTag(t);
                        onClose();
                      }}
                      className="text-xs font-semibold text-amber-800 hover:text-amber-950 hover:underline transition-colors cursor-pointer p-0 bg-transparent border-none"
                    >
                      #{t}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {sameSourceIdeas.length > 1 && onOpenMergeModal && (
                    <button
                      onClick={handleMergeSameSource}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>도서 전체 통합하기</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onClose();
                      onStartEdit(activeIdea.id);
                    }}
                    className="px-3.5 py-2 bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <PenSquare className="w-3.5 h-3.5" />
                    <span>수정</span>
                  </button>
                  <button
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>삭제</span>
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-stone-200/80 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="지식 노트 삭제"
        message={`'${activeIdea.title}' 지식 노트를 삭제하시겠습니까?`}
        onConfirm={() => {
          setIsDeleteConfirmOpen(false);
          onDelete(activeIdea.id);
          onClose();
        }}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </>
  );
};
