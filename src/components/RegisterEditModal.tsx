import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Star, Link as LinkIcon, FileText, X, Plus, Check, Loader2, Move, HelpCircle, Copy, Code, Bold, Italic, Strikethrough, Highlighter, List, ListOrdered, Quote, Heading1, Heading2, Heading3, Eye, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Idea } from '../types';
import { normalizeMarkdown } from '../utils/markdownUtils';

interface RegisterEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ideaData: Partial<Idea>) => void;
  editingIdea?: Idea | null;
  existingIdeas: Idea[];
}

export const RegisterEditModal: React.FC<RegisterEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingIdea,
  existingIdeas,
}) => {
  const [title, setTitle] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [sourceType, setSourceType] = useState<'link' | 'book' | 'general' | 'other'>('link');
  const [sourceUrl, setSourceUrl] = useState('');
  const [content, setContent] = useState('');
  const [importance, setImportance] = useState(1);
  const [hoverImportance, setHoverImportance] = useState<number | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isMdGuideOpen, setIsMdGuideOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [contentTab, setContentTab] = useState<'edit' | 'preview'>('edit');

  // Content Textarea Ref & Selection Memory for Cursor-based Insertion
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [savedSelection, setSavedSelection] = useState<{ start: number; end: number } | null>(null);

  // Dragging window position states
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (editingIdea) {
      setTitle(editingIdea.title || '');
      setTagsStr((editingIdea.tags || []).join(', '));
      setContent(editingIdea.content || '');
      setImportance(editingIdea.importance || 1);

      const src = editingIdea.sourceUrl || '';
      if (src.startsWith('📚') || src.includes('[도서]')) {
        setSourceType('book');
        setSourceUrl(src.replace(/^📚\s*\[도서\]\s*/, ''));
      } else if (src.startsWith('📄') || src.includes('[일반]')) {
        setSourceType('general');
        setSourceUrl(src.replace(/^📄\s*\[일반\]\s*/, ''));
      } else if (src.startsWith('💡') || src.includes('[기타]')) {
        setSourceType('other');
        setSourceUrl(src.replace(/^💡\s*\[기타\]\s*/, ''));
      } else {
        setSourceType('link');
        setSourceUrl(src.replace(/^🔗\s*/, ''));
      }
    } else {
      setTitle('');
      setTagsStr('');
      setSourceType('link');
      setSourceUrl('');
      setContent('');
      setImportance(1);
      setAiSummary(null);
    }
    setHoverImportance(null);
  }, [editingIdea, isOpen]);

  if (!isOpen) return null;

  // AI Auto Tag & Title Trigger
  const handleAiAutoTag = async () => {
    if (!title && !content) {
      alert('AI 분석을 위해 제목이나 본문 내용을 조금이라도 입력해주세요.');
      return;
    }

    setIsAiLoading(true);
    setAiSummary(null);

    try {
      const res = await fetch('/api/gemini/auto-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) throw new Error('AI 태그 추천 실패');

      const data = await res.json();
      if (data.suggestedTags && Array.isArray(data.suggestedTags)) {
        const existingTags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
        const combined = Array.from(new Set([...existingTags, ...data.suggestedTags]));
        setTagsStr(combined.join(', '));
      }

      if (data.suggestedTitle && !title) {
        setTitle(data.suggestedTitle);
      }

      if (data.summary) {
        setAiSummary(`💡 AI 요약: ${data.summary}`);
      }
    } catch (error: any) {
      alert(`AI 자동 추천 중 오류 발생: ${error?.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddTagChip = (tag: string) => {
    const parts = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    if (!parts.includes(tag)) {
      parts.push(tag);
      setTagsStr(parts.join(', ') + ', ');
    }
  };

  // Record cursor selection whenever user interacts with textarea
  const updateCursorSelection = () => {
    if (contentTextareaRef.current) {
      setSavedSelection({
        start: contentTextareaRef.current.selectionStart,
        end: contentTextareaRef.current.selectionEnd,
      });
    }
  };

  /**
   * Inserts markdown snippet directly at current cursor/selection position.
   * If text is selected, wraps or replaces placeholder with selected text.
   * If isBlock is true, ensures clean line breaks before and after.
   */
  const insertMarkdownAtCursor = (
    snippet: string,
    isBlock: boolean = false,
    placeholder: string = ''
  ) => {
    const textarea = contentTextareaRef.current;
    let start = savedSelection?.start ?? (textarea ? textarea.selectionStart : content.length);
    let end = savedSelection?.end ?? (textarea ? textarea.selectionEnd : content.length);

    if (start < 0 || start > content.length) start = content.length;
    if (end < 0 || end > content.length) end = content.length;
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    const selectedText = content.substring(start, end);
    let inserted = snippet;

    // If there is selected text, intelligently wrap or replace placeholder
    if (selectedText) {
      if (placeholder && inserted.includes(placeholder)) {
        inserted = inserted.replace(placeholder, selectedText);
      }
    }

    let prefix = '';
    let suffix = '';

    if (isBlock) {
      // Ensure leading newline if not at start of line
      if (start > 0 && content[start - 1] !== '\n') {
        prefix = '\n\n';
      }
      // Ensure trailing newline if following text isn't a newline
      if (end < content.length && content[end] !== '\n') {
        suffix = '\n\n';
      }
    }

    const fullInsertion = prefix + inserted + suffix;
    const newContent = content.substring(0, start) + fullInsertion + content.substring(end);
    setContent(newContent);

    const newCursorPos = start + prefix.length + inserted.length;
    setSavedSelection({ start: newCursorPos, end: newCursorPos });

    // Refocus and place cursor
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('아이디어 제목은 필수 항목입니다.');
      return;
    }

    const tagList = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const finalTags = tagList.length > 0 ? tagList : ['일반'];

    let formattedSource = sourceUrl.trim();
    if (formattedSource) {
      if (sourceType === 'book' && !formattedSource.startsWith('📚')) {
        formattedSource = `📚 [도서] ${formattedSource}`;
      } else if (sourceType === 'general' && !formattedSource.startsWith('📄')) {
        formattedSource = `📄 [일반] ${formattedSource}`;
      } else if (sourceType === 'other' && !formattedSource.startsWith('💡')) {
        formattedSource = `💡 [기타] ${formattedSource}`;
      } else if (sourceType === 'link') {
        if (!formattedSource.startsWith('http://') && !formattedSource.startsWith('https://') && !formattedSource.startsWith('www.') && !formattedSource.startsWith('🔗')) {
          formattedSource = `🔗 ${formattedSource}`;
        }
      }
    }

    onSave({
      id: editingIdea?.id,
      title: title.trim(),
      content: content.trim(),
      tags: finalTags,
      sourceUrl: formattedSource,
      importance,
    });

    onClose();
  };

  // Compute suggested tags from existing knowledge base
  const allExistingTags = Array.from(new Set(existingIdeas.flatMap((i) => i.tags || []))).filter(Boolean);
  const currentEnteredTags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
  const currentTypingTag = tagsStr.split(',').pop()?.trim() || '';

  const suggestedTagChips = allExistingTags
    .filter(
      (t) =>
        !currentEnteredTags.includes(t) &&
        (currentTypingTag ? t.toLowerCase().includes(currentTypingTag.toLowerCase()) : true)
    )
    .slice(0, 8);

  const activeStarCount = hoverImportance !== null ? hoverImportance : importance;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden transition-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Banner Header (Draggable) */}
        <div
          onMouseDown={handleMouseDown}
          className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white px-4 py-3 sm:px-5 sm:py-3.5 relative overflow-hidden shrink-0 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
        >
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center font-bold text-base shadow-inner shrink-0">
              ✨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white font-sans">
                  {editingIdea ? '지식 노트 수정' : '새 지식 노트 등록'}
                </h3>
                <span className="text-[10px] bg-white/15 text-indigo-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Move className="w-3 h-3" />
                  드래그 이동 가능
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="relative z-10 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer font-bold text-base"
            title="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Compact & Minimal Padding */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 flex flex-col gap-3 overflow-y-auto font-sans">
          
          {/* AI Auto Tag Banner */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 p-2.5 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <div className="text-xs text-purple-900 font-bold">
                <span>Gemini AI 분류 도우미</span>
                <p className="text-[11px] text-purple-700 font-normal">
                  작성 후 클릭하면 자동 태그 및 제목 추천
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAiAutoTag}
              disabled={isAiLoading}
              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-extrabold text-xs rounded-lg transition-all cursor-pointer shrink-0 flex items-center gap-1"
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>분석 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>AI 자동 분류</span>
                </>
              )}
            </button>
          </div>

          {aiSummary && (
            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-xs text-amber-900 font-semibold">
              {aiSummary}
            </div>
          )}

          {/* Title Input */}
          <div className="flex flex-col gap-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>제목</span>
              <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="생각의 핵심 제목을 입력하세요..."
              className="w-full px-3 py-2 text-base sm:text-lg border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 bg-white font-bold text-slate-900"
            />
          </div>

          {/* Tag Input & Chips */}
          <div className="flex flex-col gap-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>분류 태그 (쉼표 구분)</span>
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="예: 기획, GAS, 디자인, 스마트카"
              className="w-full px-3 py-1.5 text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-slate-800"
            />

            {suggestedTagChips.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap pt-1">
                <span className="text-[10px] font-bold text-slate-400">기존 태그:</span>
                {suggestedTagChips.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAddTagChip(tag)}
                    className="text-[10px] px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded border border-blue-200 transition-colors cursor-pointer"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Importance & Source Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            
            {/* Importance Rating */}
            <div className="sm:col-span-5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <span>중요도</span>
                </label>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded font-mono">
                  {activeStarCount}.0 / 5.0
                </span>
              </div>

              <div className="flex items-center justify-around py-1 px-2 bg-white rounded-lg border border-slate-200">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    onClick={() => setImportance(star)}
                    onMouseEnter={() => setHoverImportance(star)}
                    onMouseLeave={() => setHoverImportance(null)}
                    className={`w-5 h-5 cursor-pointer transition-transform hover:scale-110 ${
                      star <= activeStarCount ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Source Type & Input */}
            <div className="sm:col-span-7 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>출처</span>
                </label>

                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as any)}
                  className="px-2 py-0.5 text-xs font-bold border border-slate-300 rounded bg-white text-slate-800 outline-none cursor-pointer"
                >
                  <option value="link">🔗 웹 링크</option>
                  <option value="book">📚 도서</option>
                  <option value="general">📄 문서</option>
                  <option value="other">💡 메모</option>
                </select>
              </div>

              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={
                  sourceType === 'link'
                    ? 'https://...'
                    : sourceType === 'book'
                      ? '도서명 및 저자'
                      : '출처 정보'
                }
                className="w-full px-2.5 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-slate-800"
              />
            </div>

          </div>

          {/* Content Area */}
          <div className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>상세 내용</span>
                </label>

                {/* Edit / Preview Toggle */}
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setContentTab('edit')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      contentTab === 'edit'
                        ? 'bg-white text-blue-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>작성</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentTab('preview')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      contentTab === 'preview'
                        ? 'bg-white text-blue-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>미리보기</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  updateCursorSelection();
                  setIsMdGuideOpen(true);
                }}
                className="text-xs font-extrabold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
                title="마크다운 작성 가이드 확인"
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                <span>마크다운 언어 예시</span>
              </button>
            </div>

            {/* Quick Markdown Formatting Toolbar */}
            {contentTab === 'edit' && (
              <div className="flex items-center gap-1 overflow-x-auto py-1 px-1.5 bg-white border border-slate-200 rounded-lg text-xs select-none shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 pl-0.5 pr-1 shrink-0">빠른 서식:</span>
                
                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('# 1단계 대제목', true, '1단계 대제목')}
                  className="px-1.5 py-0.5 font-black text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-xs"
                  title="대제목 (H1)"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('## 2단계 중제목', true, '2단계 중제목')}
                  className="px-1.5 py-0.5 font-extrabold text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-xs"
                  title="중제목 (H2)"
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('### 3단계 소제목', true, '3단계 소제목')}
                  className="px-1.5 py-0.5 font-bold text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-xs"
                  title="소제목 (H3)"
                >
                  H3
                </button>

                <div className="w-px h-3.5 bg-slate-200 mx-0.5 shrink-0" />

                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('**강조할 텍스트**', false, '강조할 텍스트')}
                  className="px-1.5 py-0.5 font-black text-slate-800 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-xs"
                  title="굵게 (Bold)"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('*기울인 텍스트*', false, '기울인 텍스트')}
                  className="px-1.5 py-0.5 italic font-serif font-bold text-slate-800 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-xs"
                  title="기울임 (Italic)"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('~~취소선 텍스트~~', false, '취소선 텍스트')}
                  className="px-1.5 py-0.5 line-through font-semibold text-slate-600 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-xs"
                  title="취소선"
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('==형광펜 강조 텍스트==', false, '형광펜 강조 텍스트')}
                  className="px-1.5 py-0.5 bg-amber-100/80 hover:bg-amber-200 text-amber-900 font-bold rounded transition-colors shrink-0 text-[11px] border border-amber-300/60"
                  title="형광펜 강조"
                >
                  🖍️ 형광펜
                </button>

                <div className="w-px h-3.5 bg-slate-200 mx-0.5 shrink-0" />

                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('- 목록 항목\n- 다음 항목', true, '목록 항목')}
                  className="px-1.5 py-0.5 font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-[11px]"
                  title="불릿 점 목록 (- )"
                >
                  • 목록
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('1. 첫 번째 순서\n2. 두 번째 순서', true, '첫 번째 순서')}
                  className="px-1.5 py-0.5 font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-[11px]"
                  title="순서 있는 목록 (1. )"
                >
                  1. 순서
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('> 중요한 인용구', true, '중요한 인용구')}
                  className="px-1.5 py-0.5 font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-[11px]"
                  title="인용구 (> )"
                >
                  ❝ 인용
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('```\n코드 입력\n```', true, '코드 입력')}
                  className="px-1.5 py-0.5 font-mono text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-[11px]"
                  title="코드 블록"
                >
                  `코드`
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdownAtCursor('[링크 이름](https://)', false, '링크 이름')}
                  className="px-1.5 py-0.5 font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded transition-colors shrink-0 text-[11px]"
                  title="하이퍼링크"
                >
                  🔗 링크
                </button>
              </div>
            )}

            {contentTab === 'edit' ? (
              <textarea
                ref={contentTextareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  updateCursorSelection();
                }}
                onSelect={updateCursorSelection}
                onKeyUp={updateCursorSelection}
                onClick={updateCursorSelection}
                onBlur={updateCursorSelection}
                placeholder="지식 노트 상세 내용 및 아이디어를 기술하세요..."
                className="w-full px-3 py-2.5 min-h-[220px] sm:min-h-[280px] text-sm sm:text-base border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white leading-relaxed resize-y text-slate-800 font-sans"
              />
            ) : (
              <div className="w-full px-4 py-3 min-h-[220px] sm:min-h-[280px] border border-slate-300 rounded-lg bg-white overflow-y-auto max-h-[360px] text-slate-800 font-sans text-sm sm:text-base">
                {content.trim() ? (
                  <div className="markdown-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      components={{
                        p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                        li: ({ children }) => <li className="mb-1 leading-relaxed">{children}</li>,
                        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 font-semibold text-slate-900">{children}</ol>,
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                        h1: ({ children }) => <h1 className="text-xl font-black text-slate-900 mt-4 mb-2 border-b border-slate-200 pb-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-extrabold text-slate-900 mt-3 mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-bold text-slate-900 mt-2.5 mb-1.5">{children}</h3>,
                        h4: ({ children }) => <h4 className="text-sm font-bold text-slate-900 mt-2 mb-1">{children}</h4>,
                        blockquote: ({ children }) => (
                          <blockquote className="my-2 border-l-4 border-amber-500 pl-3 py-1 bg-amber-50/50 text-slate-700 italic rounded-r">
                            {children}
                          </blockquote>
                        ),
                        code: ({ className, children, ...props }) => {
                          const isInline = !className && typeof children === 'string' && !children.includes('\n');
                          if (isInline) {
                            return (
                              <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-xs font-mono border border-slate-200" {...props}>
                                {children}
                              </code>
                            );
                          }
                          return (
                            <pre className="my-2 p-2.5 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-xs font-mono">
                              <code {...props}>{children}</code>
                            </pre>
                          );
                        },
                      }}
                    >
                      {normalizeMarkdown(content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-slate-400 italic text-sm py-4 text-center">작성된 내용이 없습니다. '작성' 탭에서 내용을 입력해 보세요.</p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1 active:scale-98"
            >
              {editingIdea ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingIdea ? '수정 완료' : '저장'}</span>
            </button>
          </div>

        </form>

      </div>

      {/* Markdown Guide Popup Modal */}
      {isMdGuideOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[110] flex items-center justify-center p-3 sm:p-5 font-sans"
          onClick={() => setIsMdGuideOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-extrabold tracking-tight">마크다운(Markdown) 작성 가이드</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMdGuideOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content / Syntax Table */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs text-slate-700 leading-relaxed">
              <p className="bg-blue-50 text-blue-900 p-2.5 rounded-xl border border-blue-100 text-xs font-medium">
                💡 원하는 예시의 <span className="font-bold text-blue-700">[커서 위치 삽입]</span> 버튼을 누르면 본문에서 현재 커서가 놓인 위치에 서식이 바로 삽입됩니다.
              </p>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-800 border-b border-slate-200 text-[11px] font-extrabold uppercase">
                      <th className="py-2 px-3 border-r border-slate-200 w-28 sm:w-32">구분 (기능)</th>
                      <th className="py-2 px-3 border-r border-slate-200">마크다운 문법 예시</th>
                      <th className="py-2 px-2.5 text-center w-24">작용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-xs">
                    {[
                      { label: '대제목 (H1)', code: '# 1단계 대제목', isBlock: true, placeholder: '1단계 대제목', desc: '가장 큰 헤더' },
                      { label: '중제목 (H2)', code: '## 2단계 중제목', isBlock: true, placeholder: '2단계 중제목', desc: '중간 헤더' },
                      { label: '소제목 (H3)', code: '### 3단계 소제목', isBlock: true, placeholder: '3단계 소제목', desc: '소분류 헤더' },
                      { label: '하이라이트', code: '==형광펜 강조 텍스트==', isBlock: false, placeholder: '형광펜 강조 텍스트', desc: '노란 형광펜 효과' },
                      { label: '굵은 글씨', code: '**강조할 텍스트**', isBlock: false, placeholder: '강조할 텍스트', desc: '글자 굵게' },
                      { label: '기울임', code: '*기울인 텍스트*', isBlock: false, placeholder: '기울인 텍스트', desc: '이탤릭체' },
                      { label: '취소선', code: '~~취소선 텍스트~~', isBlock: false, placeholder: '취소선 텍스트', desc: '취소선 표시' },
                      { label: '순서없는 목록', code: '- 첫 번째 항목\n- 두 번째 항목', isBlock: true, placeholder: '', desc: '불릿 점 목록' },
                      { label: '순서있는 목록', code: '1. 첫 번째 순서\n2. 두 번째 순서', isBlock: true, placeholder: '', desc: '숫자 목록 (번호 자동 강조)' },
                      { label: '인용구', code: '> 중요한 참고 문헌 및 인용구', isBlock: true, placeholder: '중요한 참고 문헌 및 인용구', desc: '왼쪽 세로선 강조' },
                      { label: '코드 상자', code: '```\nconsole.log("Hello World");\n```', isBlock: true, placeholder: 'console.log("Hello World");', desc: '코드 블록 상자' },
                      { label: '하이퍼링크', code: '[구글 바로가기](https://google.com)', isBlock: false, placeholder: '구글 바로가기', desc: '외부 웹사이트 링크' },
                    ].map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 border-r border-slate-200/80 font-bold text-slate-900 shrink-0">
                          <div>{item.label}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{item.desc}</div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200/80">
                          <pre className="text-[11px] font-mono bg-slate-50 text-slate-800 p-1.5 rounded border border-slate-200/70 whitespace-pre-wrap leading-tight">
                            {item.code}
                          </pre>
                        </td>
                        <td className="py-2 px-2.5 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => {
                              insertMarkdownAtCursor(item.code, item.isBlock, item.placeholder);
                              setCopiedIndex(idx);
                              setTimeout(() => setCopiedIndex(null), 1200);
                            }}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-[11px] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-0.5"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">삽입됨</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>삽입</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsMdGuideOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                확인 / 닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
