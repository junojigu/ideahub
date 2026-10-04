import React, { useMemo } from 'react';
import { Search, Mic, Plus, Sparkles, ArrowRight, Youtube, BookOpen, Hash } from 'lucide-react';
import { Idea } from '../types';
import { formatDate } from '../utils/dateUtils';
import {
  SOURCE_CATEGORIES,
  extractYouTubeVideoId,
  cleanSourceTitle,
  extractMainBookTitle,
  getSourceCategory,
} from '../utils/sourceUtils';

interface HomeViewProps {
  ideas: Idea[];
  recentViewedIds: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSwitchTab: (tab: string) => void;
  onOpenPreviewModal: (ideaId: string) => void;
  onOpenRegisterModal: () => void;
  onTriggerCreativeModal: () => void;
  onSelectTag?: (tag: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  ideas,
  recentViewedIds,
  searchQuery,
  onSearchChange,
  onSwitchTab,
  onOpenPreviewModal,
  onOpenRegisterModal,
  onTriggerCreativeModal,
  onSelectTag,
}) => {
  const [isMicActive, setIsMicActive] = React.useState(false);

  const handleMicClick = () => {
    setIsMicActive(true);
    setTimeout(() => {
      setIsMicActive(false);
      onSearchChange('AI 생산성');
      onSwitchTab('preview');
    }, 1200);
  };

  // Compute recently viewed ideas
  const recentIdeas = recentViewedIds
    .map((id) => ideas.find((i) => String(i.id) === String(id)))
    .filter((i): i is Idea => Boolean(i));

  const fallbackIdeas = ideas.filter((i) => !recentIdeas.some((r) => String(r.id) === String(i.id)));
  const displayRecent = recentIdeas.concat(fallbackIdeas).slice(0, 6);

  const totalIdeas = ideas.length;
  const totalViews = ideas.reduce((acc, curr) => acc + (curr.views || 0), 0);
  const totalTagsCount = Array.from(new Set(ideas.flatMap((i) => i.tags || []))).length;

  // Compute top sources (books & documents) for quick jump
  const topSources = useMemo(() => {
    const map = new Map<string, { name: string; count: number; category: string }>();
    ideas.forEach((idea) => {
      if (!idea.sourceUrl) return;
      const cat = getSourceCategory(idea.sourceUrl);
      const name = cat === 'book' ? extractMainBookTitle(idea.sourceUrl) : cleanSourceTitle(idea.sourceUrl);
      if (!name) return;
      const key = name.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { name, count: 1, category: cat });
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [ideas]);

  // Compute top tags for quick filter
  const topTags = useMemo(() => {
    const freq = new Map<string, number>();
    ideas.forEach((idea) => {
      (idea.tags || []).forEach((t) => {
        const clean = String(t).trim();
        if (clean) freq.set(clean, (freq.get(clean) || 0) + 1);
      });
    });
    return Array.from(freq.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [ideas]);

  return (
    <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-10 sm:py-14 max-w-5xl mx-auto w-full font-sans">
      {/* Top Hero & Search Command Section */}
      <div className="max-w-2xl mx-auto w-full text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 select-none mb-2">
          IdeaHub
        </h1>

        {/* Quiet Unboxed Telemetry Summary */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium tabular-nums mb-6">
          <span>보관된 지식 <strong className="text-slate-800 font-semibold">{totalIdeas}</strong>편</span>
          <span aria-hidden="true">·</span>
          <span>분류 태그 <strong className="text-slate-800 font-semibold">{totalTagsCount}</strong>개</span>
          <span aria-hidden="true">·</span>
          <span>누적 열람 <strong className="text-slate-800 font-semibold">{totalViews}</strong>회</span>
        </div>

        {/* Minimal Command Search Bar */}
        <div className="w-full bg-white border border-slate-200/90 hover:border-slate-300 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/5 rounded-xl shadow-2xs transition-all px-3.5 py-2.5 flex items-center gap-2.5 mb-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSwitchTab('preview');
              }
            }}
            placeholder="개념, 도서명, #태그 또는 키워드로 지식 검색..."
            className="w-full text-sm sm:text-base text-slate-900 placeholder-slate-400 bg-transparent outline-none font-normal"
          />

          <button
            type="button"
            onClick={handleMicClick}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
              isMicActive
                ? 'text-red-600 bg-red-50 animate-pulse'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="음성 검색"
          >
            <Mic className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          <button
            type="button"
            onClick={onOpenRegisterModal}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>새 노트</span>
          </button>
        </div>

        {/* Single-Row Clean Filter & Action Strip */}
        <div className="flex items-center justify-between gap-2 flex-wrap px-1">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onSwitchTab('preview');
              }}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              전체 피드
            </button>
            <span className="text-slate-300 text-xs" aria-hidden="true">/</span>
            {SOURCE_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  onSearchChange(cat.tag);
                  onSwitchTab('preview');
                }}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                {cat.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onSearchChange('#사진');
                onSwitchTab('preview');
              }}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              사진·촬영
            </button>
          </div>

          <button
            type="button"
            onClick={onTriggerCreativeModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI 아이디어 발상</span>
          </button>
        </div>
      </div>

      {/* Functional 2-Column Workspace Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start border-t border-slate-200/80 pt-8">
        {/* Left Column: Recently Viewed Notes (7 cols) */}
        <div className="md:col-span-7 bg-white border border-slate-200/80 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-900 tracking-tight">
              최근 열어본 지식
            </h2>
            <button
              type="button"
              onClick={() => onSwitchTab('preview')}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>전체 보기</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {displayRecent.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-400 mb-2">아직 등록되거나 열람한 지식이 없습니다.</p>
              <button
                type="button"
                onClick={onOpenRegisterModal}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                첫 번째 노트 작성하기
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {displayRecent.map((idea) => {
                const formattedDate = formatDate(idea.date, idea.id);
                const cleanSrc = extractMainBookTitle(idea.sourceUrl) || cleanSourceTitle(idea.sourceUrl);
                const hasVideo = Boolean(extractYouTubeVideoId(idea.sourceUrl));

                return (
                  <li key={idea.id}>
                    <button
                      type="button"
                      onClick={() => onOpenPreviewModal(idea.id)}
                      className="w-full flex items-center justify-between gap-3 text-left py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {hasVideo && (
                          <Youtube className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        )}
                        <span className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                          {idea.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0 tabular-nums">
                        {cleanSrc && !cleanSrc.startsWith('http') && (
                          <>
                            <span className="max-w-[110px] truncate hidden sm:inline text-slate-500">
                              {cleanSrc}
                            </span>
                            <span className="hidden sm:inline" aria-hidden="true">·</span>
                          </>
                        )}
                        {formattedDate && <span>{formattedDate}</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right Column: Top Sources & Frequent Tags (5 cols) */}
        <div className="md:col-span-5 space-y-5">
          {/* Top Books & Sources */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>주요 도서 및 출처</span>
              </h2>
              <span className="text-[11px] text-slate-400 tabular-nums">클릭 시 바로 탐색</span>
            </div>

            {topSources.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">등록된 주요 출처가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {topSources.map((src) => (
                  <li key={src.name}>
                    <button
                      type="button"
                      onClick={() => {
                        onSearchChange(src.name);
                        onSwitchTab('preview');
                      }}
                      className="w-full flex items-center justify-between gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 text-left transition-colors cursor-pointer group"
                    >
                      <span className="text-xs font-medium text-slate-700 group-hover:text-slate-950 truncate">
                        {src.name}
                      </span>
                      <span className="text-xs text-slate-400 font-mono tabular-nums shrink-0">
                        {src.count}편
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Frequent Tags */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
              <h2 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                <span>자주 찾는 태그</span>
              </h2>
            </div>

            {topTags.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">등록된 태그가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {topTags.map((tag) => (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => {
                      if (onSelectTag) {
                        onSelectTag(tag.name);
                      } else {
                        onSearchChange(`#${tag.name}`);
                        onSwitchTab('preview');
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-950 bg-slate-50 hover:bg-slate-100 border border-slate-200/70 rounded-lg transition-colors cursor-pointer tabular-nums whitespace-nowrap"
                  >
                    #{tag.name} <span className="text-slate-400 ml-0.5">{tag.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
