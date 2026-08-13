import React, { useState } from 'react';
import { BookOpen, Calendar, Eye, Star, PenSquare, Trash2, X, ExternalLink, Book, FileText, Lightbulb } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Idea } from '../types';
import { formatDate } from '../utils/dateUtils';
import { renderHighlightedText } from '../utils/highlightUtils';
import { ConfirmModal } from './ConfirmModal';

interface EBookReaderModalProps {
  idea: Idea | null;
  isOpen: boolean;
  onClose: () => void;
  onStartEdit: (ideaId: string) => void;
  onDelete: (ideaId: string) => void;
  onSelectTag: (tag: string) => void;
  searchQuery?: string;
}

export const EBookReaderModal: React.FC<EBookReaderModalProps> = ({
  idea,
  isOpen,
  onClose,
  onStartEdit,
  onDelete,
  onSelectTag,
  searchQuery = '',
}) => {
  const [fontSize, setFontSize] = useState(17); // base 17px
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  if (!isOpen || !idea) return null;

  const plainText = (idea.content || '').replace(/<[^>]*>/g, '').trim();
  const charCount = plainText.length;
  const estMinutes = Math.max(1, Math.ceil(charCount / 400));

  const adjustFontSize = (delta: number) => {
    setFontSize((prev) => Math.min(24, Math.max(14, prev + delta)));
  };

  const renderSourceBadge = (sourceStr?: string) => {
    if (!sourceStr) return null;
    const clean = sourceStr.trim();

    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('www.') || clean.startsWith('🔗')) {
      const href = clean.replace(/^🔗\s*/, '').startsWith('www.') ? `https://${clean}` : clean.replace(/^🔗\s*/, '');
      return (
        <a
          href={href.startsWith('http') ? href : `https://${href}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>{clean.replace(/^🔗\s*/, '')}</span>
        </a>
      );
    }

    if (clean.startsWith('📚') || clean.includes('[도서]')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
          <Book className="w-3.5 h-3.5 text-amber-600" />
          <span>{clean.replace(/^📚\s*\[도서\]\s*/, '')}</span>
        </span>
      );
    }

    if (clean.startsWith('📄') || clean.includes('[일반]')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
          <FileText className="w-3.5 h-3.5 text-emerald-600" />
          <span>{clean.replace(/^📄\s*\[일반\]\s*/, '')}</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-900 border border-indigo-200">
        <Lightbulb className="w-3.5 h-3.5 text-indigo-600" />
        <span>{clean.replace(/^💡\s*\[기타\]\s*/, '')}</span>
      </span>
    );
  };

  // Helper to highlight tags and search terms in React Markdown text nodes
  const tagsToHighlight = (idea.tags || []).filter((t) => t && t !== '일반');

  const renderTextWithHighlights = (nodeChildren: React.ReactNode): React.ReactNode => {
    if (typeof nodeChildren === 'string') {
      // First apply search term highlighting if searchQuery exists
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

    // Combined regex for:
    // 1. Highlight: ==text==
    // 2. Footnote definition or reference: [^id]: explanation OR [^id]
    // 3. Item marker: 1. , 2) , (1) , [1] , ①
    const combinedRegex = /(==(.*?)==)|(\[\^([^\]]+)\](?::\s*(.*))?)|((?:^|\s)(?:\d+[\.\)]|\(\d+\)|\[\d+\]|[①-⑩])(?:\s+|$))/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = combinedRegex.exec(textStr)) !== null) {
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        parts.push(textStr.substring(lastIndex, matchIndex));
      }

      if (match[1]) {
        // Match 1: ==highlight text==
        const highlightText = match[2];
        parts.push(
          <mark key={`hl-${matchIndex}`} className="bg-amber-200/90 text-stone-900 font-semibold px-1 py-0.5 rounded-xs m-0 inline">
            {highlightText}
          </mark>
        );
      } else if (match[3]) {
        // Match 3: Footnote [^id] or [^id]: definition
        const fnId = match[4];
        const fnDef = match[5];

        if (fnDef !== undefined) {
          // Footnote definition line
          parts.push(
            <span key={`fndef-${matchIndex}`} className="block my-1 text-xs text-stone-600 bg-stone-100/80 px-2.5 py-1 rounded-md border-l-2 border-amber-500 font-sans">
              <span className="font-bold text-amber-800 mr-1 font-mono">[{fnId}] 각주:</span>
              <span>{fnDef}</span>
            </span>
          );
        } else {
          // Inline Footnote marker
          parts.push(
            <sup key={`fn-${matchIndex}`} className="text-amber-800 font-black bg-amber-100/90 border border-amber-300 px-1 py-0.2 rounded-xs text-[10px] mx-0.5 cursor-pointer hover:bg-amber-200 inline-block align-super" title={`각주 ${fnId}`}>
              [{fnId}]
            </sup>
          );
        }
      } else if (match[6]) {
        // Match 6: Number/Symbol marker
        const rawMarker = match[6];
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

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 font-sans"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Reader Header Bar */}
          <div className="px-6 py-4 border-b border-stone-200/80 bg-[#faf9f6] flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2.5 text-stone-600 text-xs font-bold">
              <BookOpen className="w-4 h-4 text-amber-700" />
              <span>전자책 읽기 모드</span>
              <span className="text-stone-300">•</span>
              <span className="text-stone-500 font-normal">약 {estMinutes}분 독서</span>
              <span className="text-stone-300">•</span>
              <span className="text-stone-400 font-normal">{charCount.toLocaleString()}자</span>
            </div>

            <div className="flex items-center gap-2">
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

          {/* E-Book Reader Body */}
          <div className="flex-1 overflow-y-auto bg-[#fdfbf7] p-6 sm:p-8 md:p-10 flex flex-col justify-between">
            <div className="space-y-6">
              
              {/* Title & Metadata */}
              <div className="border-b border-stone-200/80 pb-5">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-stone-900 leading-snug tracking-tight font-sans">
                  {renderHighlightedText(idea.title, searchQuery)}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>{formatDate(idea.date)}</span>
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="flex items-center gap-1.5 text-stone-600">
                    <Eye className="w-3.5 h-3.5 text-stone-400" />
                    <span>조회 {idea.views || 1}회</span>
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-stone-400">중요도:</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: idea.importance || 1 }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      ))}
                    </div>
                  </span>
                </div>
              </div>

              {/* Reading Text Surface with Tag & Search Highlights */}
              <div
                style={{ fontSize: `${fontSize}px` }}
                className="text-stone-800 leading-[1.85] tracking-normal font-sans min-h-[200px]"
              >
                <div className="markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-4 whitespace-pre-line leading-relaxed">{renderTextWithHighlights(children)}</p>,
                      li: ({ children }) => <li className="mb-1.5 whitespace-pre-line leading-relaxed font-normal">{renderTextWithHighlights(children)}</li>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1.5 my-3 font-bold text-stone-950">{children}</ol>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1.5 my-3">{children}</ul>,
                      h1: ({ children }) => <h1 className="text-2xl font-black text-stone-900 my-4 border-b border-stone-200 pb-1">{renderTextWithHighlights(children)}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-extrabold text-stone-900 my-3">{renderTextWithHighlights(children)}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-bold text-stone-900 my-2">{renderTextWithHighlights(children)}</h3>,
                      section: ({ node, ...props }) => {
                        if (props['data-footnotes'] !== undefined || (typeof props.className === 'string' && props.className.includes('footnotes'))) {
                          return (
                            <section className="mt-8 pt-4 border-t-2 border-dashed border-amber-300 text-xs text-stone-700 space-y-2 bg-amber-50/50 p-4 rounded-xl border border-amber-200/80">
                              <div className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5">
                                📌 각주 (Footnotes)
                              </div>
                              {props.children}
                            </section>
                          );
                        }
                        return <section {...props} />;
                      },
                      sup: ({ children }) => (
                        <sup className="text-amber-900 font-black bg-amber-100 border border-amber-300 px-1 py-0.2 rounded-xs text-[10px] mx-0.5 align-super inline-block">
                          {children}
                        </sup>
                      ),
                      a: ({ href, children }) => {
                        const isFootnoteRef = href?.includes('#fn') || href?.includes('#user-content-fn');
                        if (isFootnoteRef) {
                          return (
                            <a href={href} className="text-amber-900 font-bold hover:underline">
                              {children}
                            </a>
                          );
                        }
                        return (
                          <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">
                            {children}
                          </a>
                        );
                      },
                    }}
                  >
                    {(() => {
                      const raw = idea.content || '본문 내용이 비어있습니다.';
                      let str = raw.replace(/\r\n/g, '\n');
                      // Ensure footnote definition [^1]: starts on a new block (\n\n) so Markdown parser recognizes it
                      str = str.replace(/([^\n])\n*(\[\^[^\]]+\]:)/g, '$1\n\n$2');
                      return str;
                    })()}
                  </ReactMarkdown>
                </div>
              </div>

            </div>

            {/* Footer Metadata & Actions */}
            <div className="mt-8 pt-6 border-t border-stone-200/80 space-y-4">
              {idea.sourceUrl && (
                <div>
                  <div className="text-xs font-semibold text-stone-400 mb-1.5">출처 및 참고 자료</div>
                  {renderSourceBadge(idea.sourceUrl)}
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-amber-900">연관 태그:</span>
                  {(idea.tags || []).map((t, idx) => (
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
                  <button
                    onClick={() => {
                      onClose();
                      onStartEdit(idea.id);
                    }}
                    className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
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
        message={`'${idea.title}' 지식 노트를 삭제하시겠습니까?`}
        onConfirm={() => {
          setIsDeleteConfirmOpen(false);
          onDelete(idea.id);
          onClose();
        }}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </>
  );
};

