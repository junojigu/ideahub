import React, { useState, useEffect } from 'react';
import { 
  Layers, X, ArrowUp, ArrowDown, Trash2, Sparkles, FileText, Check, 
  Copy, Eye, Edit3, Loader2, BookOpen, AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Idea } from '../types';
import { normalizeMarkdown } from '../utils/markdownUtils';
import { cleanSourceTitle, extractMainBookTitle } from '../utils/sourceUtils';

interface MergeNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIdeas: Idea[];
  onSaveMergedIdea: (mergedData: Partial<Idea>, originalIdsToDelete?: string[]) => void;
}

export const MergeNotesModal: React.FC<MergeNotesModalProps> = ({
  isOpen,
  onClose,
  selectedIdeas,
  onSaveMergedIdea,
}) => {
  const [orderedIdeas, setOrderedIdeas] = useState<Idea[]>([]);
  const [mergeMode, setMergeMode] = useState<'standard' | 'ai'>('standard');
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [content, setContent] = useState('');
  const [importance, setImportance] = useState(3);
  const [deleteOriginals, setDeleteOriginals] = useState(false);
  const [viewTab, setViewTab] = useState<'edit' | 'preview'>('edit');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize ordered ideas and default fields when modal opens
  useEffect(() => {
    if (isOpen && selectedIdeas.length > 0) {
      setOrderedIdeas([...selectedIdeas]);

      // Detect common source
      const firstSource = selectedIdeas[0]?.sourceUrl || '';
      const firstBookTitle = extractMainBookTitle(firstSource);
      const allShareSameSource = selectedIdeas.every((i) => extractMainBookTitle(i.sourceUrl) === firstBookTitle);
      const initialSource = allShareSameSource ? (firstSource.includes('[도서]') || firstSource.includes('📚') ? `📚 [도서] ${firstBookTitle}` : firstSource) : '';
      setSourceUrl(initialSource);

      const defaultTitle = firstBookTitle 
        ? `[통합] ${firstBookTitle} 핵심 발췌 및 정리` 
        : `[통합] ${selectedIdeas[0]?.title || '노트'} 외 ${selectedIdeas.length - 1}편`;
      setTitle(defaultTitle);

      // Union of unique tags
      const allTags = Array.from(new Set(selectedIdeas.flatMap((i) => i.tags || []))).filter(Boolean);
      setTagsStr(allTags.join(', '));

      // Calculate average or max importance
      const maxImp = Math.max(...selectedIdeas.map((i) => i.importance || 1));
      setImportance(maxImp);

      // Generate standard markdown
      generateStandardMergeContent(selectedIdeas);
      setMergeMode('standard');
      setViewTab('edit');
    }
  }, [isOpen, selectedIdeas]);

  if (!isOpen || selectedIdeas.length === 0) return null;

  // Generate standard sequential markdown
  const generateStandardMergeContent = (ideas: Idea[]) => {
    const sections = ideas.map((idea, index) => {
      const dateInfo = idea.date ? `*(작성일: ${idea.date})*` : '';
      return `## ${index + 1}. ${idea.title}\n${dateInfo}\n\n${(idea.content || '').trim()}`;
    });

    const combined = sections.join('\n\n---\n\n');
    setContent(combined);
  };

  // Move idea up in order
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const nextList = [...orderedIdeas];
    const temp = nextList[index - 1];
    nextList[index - 1] = nextList[index];
    nextList[index] = temp;
    setOrderedIdeas(nextList);
    if (mergeMode === 'standard') {
      generateStandardMergeContent(nextList);
    }
  };

  // Move idea down in order
  const handleMoveDown = (index: number) => {
    if (index === orderedIdeas.length - 1) return;
    const nextList = [...orderedIdeas];
    const temp = nextList[index + 1];
    nextList[index + 1] = nextList[index];
    nextList[index] = temp;
    setOrderedIdeas(nextList);
    if (mergeMode === 'standard') {
      generateStandardMergeContent(nextList);
    }
  };

  // Remove idea from merge list
  const handleRemoveIdea = (id: string) => {
    if (orderedIdeas.length <= 1) {
      alert('통합을 위해 최소 1개 이상의 노트가 필요합니다.');
      return;
    }
    const nextList = orderedIdeas.filter((i) => i.id !== id);
    setOrderedIdeas(nextList);
    if (mergeMode === 'standard') {
      generateStandardMergeContent(nextList);
    }
  };

  // Trigger AI smart merge
  const handleAiSmartMerge = async () => {
    setIsAiLoading(true);
    setMergeMode('ai');

    try {
      const bookName = sourceUrl.replace(/^[📚📄💡🔗]\s*(\[.*?\])?\s*/, '').trim();
      const response = await fetch('/api/gemini/merge-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: orderedIdeas.map((i) => ({
            title: i.title,
            content: i.content,
            date: i.date,
          })),
          bookTitle: bookName || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('AI 스마트 통합 요청 실패');
      }

      const data = await response.json();
      if (data.mergedTitle) {
        setTitle(data.mergedTitle);
      }
      if (data.mergedContent) {
        setContent(data.mergedContent);
      }
      setViewTab('preview');
    } catch (err: any) {
      alert(`AI 통합 중 오류가 발생했습니다: ${err?.message}`);
      setMergeMode('standard');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Copy merged markdown to clipboard
  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Save merged idea
  const handleSave = () => {
    if (!title.trim()) {
      alert('통합 노트의 제목을 입력해 주세요.');
      return;
    }

    const tags = tagsStr
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    onSaveMergedIdea(
      {
        title: title.trim(),
        content: content.trim(),
        tags: tags.length > 0 ? tags : ['통합'],
        sourceUrl: sourceUrl.trim() || undefined,
        importance,
      },
      deleteOriginals ? orderedIdeas.map((i) => i.id) : undefined
    );

    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 font-sans"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 font-sans tracking-tight">
                지식 노트 하나로 통합하기 (Merge Notes)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                선택한 {orderedIdeas.length}개의 노트를 논리적인 하나의 완성본으로 결합합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* 1. Reordering Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>통합할 노트 순서 조정 ({orderedIdeas.length}개)</span>
              </span>
              <span className="text-slate-400 font-normal">
                ▲ ▼ 버튼으로 위/아래 순서를 변경할 수 있습니다.
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200">
              {orderedIdeas.map((idea, idx) => (
                <div
                  key={idea.id}
                  className="bg-white border border-slate-200/80 rounded-xl px-3.5 py-2 flex items-center justify-between gap-3 shadow-2xs text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 font-black text-[11px] flex items-center justify-center shrink-0 border border-blue-200">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900 truncate">
                      {idea.title}
                    </span>
                    {idea.date && (
                      <span className="text-slate-400 text-[11px] shrink-0">
                        ({idea.date})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      title="위로 이동"
                      className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === orderedIdeas.length - 1}
                      title="아래로 이동"
                      className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveIdea(idea.id)}
                      title="통합 목록에서 제외"
                      className="p-1 rounded text-red-500 hover:bg-red-50 cursor-pointer ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Merge Mode Switcher */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black text-slate-800">통합 방식 선택</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                순서대로 붙여 원문을 온전히 보존하거나, AI로 한 편의 완성형 글로 재구성할 수 있습니다.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMergeMode('standard');
                  generateStandardMergeContent(orderedIdeas);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  mergeMode === 'standard'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>단순 원문 병합 (순서 보존)</span>
              </button>

              <button
                type="button"
                onClick={handleAiSmartMerge}
                disabled={isAiLoading}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  mergeMode === 'ai'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                {isAiLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>✨ AI 스마트 요약·통합</span>
              </button>
            </div>
          </div>

          {/* 3. Merged Metadata Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                통합 노트 제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="새 통합 노트의 제목을 입력하세요"
                className="w-full px-3.5 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                출처 정보 (도서 / 링크)
              </label>
              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="예: 📚 [도서] 강신주의 노자 혹은 장자"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                통합 태그 (쉼표로 구분)
              </label>
              <input
                type="text"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="예: 철학, 노자, 장자, 강신주"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* 4. Merged Content Area (Edit / Preview) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">통합 본문 내용</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  ({content.length.toLocaleString()}자)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '복사됨' : '본문 복사'}</span>
                </button>

                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setViewTab('edit')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                      viewTab === 'edit'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>편집</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab('preview')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                      viewTab === 'preview'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>미리보기</span>
                  </button>
                </div>
              </div>
            </div>

            {viewTab === 'edit' ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="통합될 마크다운 내용..."
                className="w-full p-4 text-xs sm:text-sm font-mono leading-relaxed border border-slate-300 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
              />
            ) : (
              <div className="min-h-[280px] max-h-[420px] overflow-y-auto p-5 bg-[#fdfbf7] border border-stone-200 rounded-2xl">
                <div className="markdown-body text-xs sm:text-sm text-stone-800 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {normalizeMarkdown(content || '내용이 없습니다.')}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* 5. Original Notes Handling Option */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-3">
            <input
              type="checkbox"
              id="delete-originals-cb"
              checked={deleteOriginals}
              onChange={(e) => setDeleteOriginals(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0 mt-0.5"
            />
            <label htmlFor="delete-originals-cb" className="text-xs text-amber-950 font-semibold cursor-pointer">
              <span className="font-bold">통합 저장 후 기존 원본 메모 {orderedIdeas.length}개 삭제하기</span>
              <p className="text-amber-800 text-[11px] font-normal mt-0.5">
                체크 해제 시 원본 메모들을 그대로 안전하게 보관하면서 새로운 통합 노트가 추가됩니다. (체크 시 낱개 메모를 통합본 1개로 교체)
              </p>
            </label>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            총 {orderedIdeas.length}개 메모가 하나로 합쳐집니다.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-2xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>통합 노트로 저장하기</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
