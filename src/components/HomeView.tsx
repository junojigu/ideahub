import React from 'react';
import { Search, Mic, Plus, Sparkles, Eye, BookOpen, Layers, ArrowRight, Clock } from 'lucide-react';
import { Idea } from '../types';

interface HomeViewProps {
  ideas: Idea[];
  recentViewedIds: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSwitchTab: (tab: string) => void;
  onOpenPreviewModal: (ideaId: string) => void;
  onOpenRegisterModal: () => void;
  onTriggerCreativeModal: () => void;
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
  const displayRecent = recentIdeas.concat(fallbackIdeas).slice(0, 5);

  const totalIdeas = ideas.length;
  const totalViews = ideas.reduce((acc, curr) => acc + (curr.views || 0), 0);
  const totalTagsCount = Array.from(new Set(ideas.flatMap((i) => i.tags || []))).length;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 md:py-16 max-w-4xl mx-auto w-full text-center relative overflow-hidden font-sans">
      
      {/* Background Soft Lighting Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gradient-to-tr from-blue-100/60 via-indigo-100/40 to-purple-100/30 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      {/* Sleek Hero Display Header */}
      <div className="mb-6 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50/80 border border-blue-200/60 text-blue-700 text-xs font-bold rounded-full mb-2 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>지능형 지식창고 & 아이디어 파이프라인</span>
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-slate-900 select-none">
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 bg-clip-text text-transparent">
            IdeaHub
          </span>
        </h1>

        <p className="text-slate-500 text-sm sm:text-base font-medium max-w-lg mx-auto leading-relaxed">
          흩어진 영감과 학습 지식을 검색하고, 연관 태그 네트워크로 확장하세요
        </p>
      </div>

      {/* Main Big Search Bar */}
      <div className="w-full max-w-2xl bg-white border border-slate-200/90 hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100/80 rounded-2xl shadow-sm hover:shadow-md transition-all px-4 py-3 flex items-center gap-3 mb-6 group">
        <Search className="w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSwitchTab('preview');
            }
          }}
          placeholder="개념 검색, 태그 키워드 또는 아이디어 탐색..."
          className="w-full text-base text-slate-800 placeholder-slate-400 bg-transparent outline-none font-medium"
        />
        
        <button
          onClick={handleMicClick}
          className={`p-1.5 rounded-xl transition-colors cursor-pointer shrink-0 ${
            isMicActive ? 'text-red-500 animate-pulse bg-red-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
          title="음성 입력"
        >
          <Mic className="w-4.5 h-4.5" />
        </button>

        <div className="h-5 w-px bg-slate-200 shrink-0"></div>

        <button
          onClick={onOpenRegisterModal}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs transition-all shadow-2xs hover:shadow cursor-pointer shrink-0 flex items-center gap-1 active:scale-98"
          title="새 지식 등록"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">새 노하우</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        <button
          onClick={() => onSwitchTab('preview')}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-sm hover:shadow active:scale-98 flex items-center gap-1.5"
        >
          <span>지식 피드 검색</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onTriggerCreativeModal}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm hover:shadow-md active:scale-98"
        >
          <Sparkles className="w-4 h-4" />
          <span>I'm Feeling Creative (AI 발상)</span>
        </button>
      </div>

      {/* Vault Statistics Quick Row */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 mb-10 text-xs font-semibold text-slate-600 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-full shadow-2xs">
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>보관함: <strong className="text-slate-900 font-bold">{totalIdeas}개</strong></span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-full shadow-2xs">
          <Eye className="w-3.5 h-3.5 text-indigo-600" />
          <span>누적 열람: <strong className="text-slate-900 font-bold">{totalViews}회</strong></span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-full shadow-2xs">
          <Layers className="w-3.5 h-3.5 text-purple-600" />
          <span>분류 태그: <strong className="text-slate-900 font-bold">{totalTagsCount}개</strong></span>
        </div>
      </div>

      {/* Recently Viewed Knowledge - Borderless Clean List */}
      <div className="w-full max-w-lg flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2 text-slate-800">
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-extrabold font-sans tracking-tight text-slate-700">
            최근 열어본 지식
          </span>
        </div>

        {/* Borderless List Area */}
        <div className="w-full text-left">
          {displayRecent.length === 0 ? (
            <p className="py-3 text-center text-xs text-slate-400 font-medium">최근에 열어본 아이디어가 없습니다.</p>
          ) : (
            <ul className="w-full divide-y divide-slate-100">
              {displayRecent.map((idea) => {
                const dateParts = (idea.date || '').split('T')[0].split('-');
                const shortDate = dateParts.length >= 3 ? `${dateParts[1]}/${dateParts[2]}` : idea.date;

                return (
                  <li key={idea.id}>
                    <button
                      type="button"
                      onClick={() => onOpenPreviewModal(idea.id)}
                      className="w-full flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 px-3 py-2.5 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 group-hover:scale-125 transition-transform"></span>
                        {shortDate && (
                          <span className="text-xs font-semibold text-slate-400 font-mono shrink-0">
                            {shortDate}
                          </span>
                        )}
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                          {idea.title}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0 font-medium group-hover:text-slate-600">
                        조회 {idea.views || 0}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            onClick={() => onSwitchTab('preview')}
            className="mt-3 text-xs font-bold text-slate-500 hover:text-blue-600 hover:underline flex items-center justify-center gap-1 cursor-pointer mx-auto transition-colors"
          >
            <span>... 더보기 (피드 전체보기)</span>
          </button>
        </div>
      </div>

    </div>
  );
};
