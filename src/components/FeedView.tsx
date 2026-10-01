import React, { useState, useMemo } from 'react';
import { 
  Sparkles, RotateCw, Filter, ChevronDown, Trash2, ArrowUpDown, 
  Star, Eye, PenSquare, ArrowRight, ExternalLink, Book, FileText, Lightbulb,
  Download, Network, CheckSquare, Square, Plus, Layers, X, Youtube, Play, Camera
} from 'lucide-react';
import { Idea } from '../types';
import { formatDate, parseTimestamp } from '../utils/dateUtils';
import { renderHighlightedText } from '../utils/highlightUtils';
import { 
  cleanSourceTitle, 
  extractMainBookTitle, 
  getSourceType, 
  SourceCategory, 
  SOURCE_CATEGORIES, 
  getSourceCategory, 
  parseSourceCategorySearch,
  isPhotoIdea,
  PHOTO_PRESET_TAGS,
  extractYouTubeVideoId,
  getIdeaYouTubeInfo,
  isYouTubeUrl
} from '../utils/sourceUtils';
import { ConfirmModal } from './ConfirmModal';
import { YouTubePlayerModal } from './YouTubePlayerModal';

interface FeedViewProps {
  ideas: Idea[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTags: string[];
  onSelectTags: (tags: string[]) => void;
  selectedSubTags: string[];
  onSelectSubTags: (subTags: string[]) => void;
  onOpenPreviewModal: (ideaId: string) => void;
  onStartEditIdea: (ideaId: string) => void;
  onDeleteSingleIdea: (ideaId: string) => void;
  onBatchDeleteIdeas: (ids: string[]) => void;
  todayRecIdea: Idea | null;
  onRefreshTodayRec: () => void;
  pageSize: number;
  onExportData: (format: 'json' | 'csv') => void;
  onOpenRegisterModal?: () => void;
  onOpenMergeModal?: (ideas: Idea[]) => void;
  onOpenContinuousReading?: (sourceUrl: string, sampleIdeaId?: string) => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  ideas,
  searchQuery,
  onSearchChange,
  selectedTags,
  onSelectTags,
  selectedSubTags,
  onSelectSubTags,
  onOpenPreviewModal,
  onStartEditIdea,
  onDeleteSingleIdea,
  onBatchDeleteIdeas,
  todayRecIdea,
  onRefreshTodayRec,
  pageSize,
  onExportData,
  onOpenRegisterModal,
  onOpenMergeModal,
  onOpenContinuousReading,
}) => {
  const [sortField, setSortField] = useState<'date' | 'views' | 'importance' | 'title'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single'; id: string; title?: string } | { type: 'batch'; ids: string[] } | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedSourceCategory, setSelectedSourceCategory] = useState<SourceCategory>('all');
  
  // Tag dropdown & search states
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [tagSortOrder, setTagSortOrder] = useState<'count' | 'alphabetical'>('count');
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);

  // Photography special filter state
  const [isPhotoFilterActive, setIsPhotoFilterActive] = useState(false);

  // Active YouTube video player modal state
  const [activeYouTubeVideo, setActiveYouTubeVideo] = useState<{
    videoId: string;
    title: string;
    videoUrl?: string;
    idea?: Idea | null;
  } | null>(null);

  // Compute Book Shelf / Source statistics sorted by: 도서 -> 문서 -> 메모 -> 웹링크
  const sourceStats = useMemo(() => {
    const map = new Map<
      string,
      {
        rawSource: string;
        count: number;
        displayName: string;
        category: 'book' | 'document' | 'memo' | 'link';
        isYouTube: boolean;
      }
    >();

    ideas.forEach((idea) => {
      const src = (idea.sourceUrl || '').trim();
      if (!src) return;
      const clean = cleanSourceTitle(src);
      if (!clean) return;

      const mainTitle = extractMainBookTitle(src);
      const category = getSourceCategory(src); // 'book' | 'document' | 'memo' | 'link'
      const isYouTube = isYouTubeUrl(src);

      // Group key: for books, group by main title so p.1, p.2 are grouped together
      const key = category === 'book' ? mainTitle.toLowerCase() : clean.toLowerCase();
      const existing = map.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          rawSource: src,
          count: 1,
          displayName: category === 'book' ? mainTitle : clean,
          category,
          isYouTube,
        });
      }
    });

    // Requested Priority Order: 1. 도서 -> 2. 문서 -> 3. 메모 -> 4. 웹링크
    const categoryOrder: Record<string, number> = {
      book: 1,      // 1. 도서
      document: 2,  // 2. 문서
      memo: 3,      // 3. 메모
      link: 4,      // 4. 웹링크
    };

    return Array.from(map.values()).sort((a, b) => {
      const orderA = categoryOrder[a.category] ?? 99;
      const orderB = categoryOrder[b.category] ?? 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // Within each category, sort by count descending (most frequent first)
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.displayName.localeCompare(b.displayName, 'ko');
    });
  }, [ideas]);

  // Compute Source Category counts (웹링크, 도서, 문서, 메모)
  const sourceCategoryCounts = useMemo(() => {
    const counts: Record<SourceCategory, number> = {
      all: ideas.length,
      book: 0,
      link: 0,
      document: 0,
      memo: 0,
    };
    ideas.forEach((idea) => {
      const cat = getSourceCategory(idea.sourceUrl);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [ideas]);

  // Parse smart source tags from search query (e.g. "[도서]", "[웹링크]", "[문서]", "[메모]")
  const { sourceCategory: queryCategory, cleanQuery } = useMemo(
    () => parseSourceCategorySearch(searchQuery),
    [searchQuery]
  );

  const activeSourceCategory: SourceCategory =
    queryCategory !== 'all' ? queryCategory : selectedSourceCategory;

  // Parse search terms from clean query
  const searchTerms = useMemo(() => {
    return cleanQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }, [cleanQuery]);

  // Filter ideas
  const filteredIdeas = ideas.filter((idea) => {
    // 0. Photography special filter
    if (isPhotoFilterActive && !isPhotoIdea(idea)) {
      return false;
    }

    // 1. Source Category filter (웹링크, 도서, 문서, 메모)
    if (activeSourceCategory !== 'all') {
      const ideaCategory = getSourceCategory(idea.sourceUrl);
      if (ideaCategory !== activeSourceCategory) return false;
    }

    // 2. Specific Book Shelf filter
    if (selectedSource) {
      if (!idea.sourceUrl || !String(idea.sourceUrl).trim()) return false;
      const targetKey = selectedSource.trim().toLowerCase();
      const cleanIdea = cleanSourceTitle(idea.sourceUrl).toLowerCase();
      const mainIdea = extractMainBookTitle(idea.sourceUrl).toLowerCase();
      const matchesSource = Boolean(
        (cleanIdea && (cleanIdea.includes(targetKey) || targetKey.includes(cleanIdea))) ||
        (mainIdea && (mainIdea.includes(targetKey) || targetKey.includes(mainIdea)))
      );
      if (!matchesSource) return false;
    }

    // 3. Tag filter
    if (selectedTags.length > 0) {
      if (!selectedTags.every((t) => idea.tags?.includes(t))) return false;
    }
    if (selectedSubTags.length > 0) {
      if (!selectedSubTags.every((t) => idea.tags?.includes(t))) return false;
    }

    // 4. Search query filter (matches title, content, tags, AND sourceUrl!)
    if (searchTerms.length > 0) {
      const title = (idea.title || '').toLowerCase();
      const content = (idea.content || '').toLowerCase();
      const tagsStr = (idea.tags || []).join(' ').toLowerCase();
      const source = (idea.sourceUrl || '').toLowerCase();

      const matchesAll = searchTerms.every(
        (term) =>
          title.includes(term) ||
          content.includes(term) ||
          tagsStr.includes(term) ||
          source.includes(term)
      );
      if (!matchesAll) return false;
    }

    return true;
  });

  // Sort ideas with reliable date timestamp parsing
  const sortedIdeas = [...filteredIdeas].sort((a, b) => {
    if (sortField === 'date') {
      const timeA = parseTimestamp(a.date, a.id);
      const timeB = parseTimestamp(b.date, b.id);
      if (timeA !== timeB) {
        return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return sortDir === 'asc'
        ? String(a.id || '').localeCompare(String(b.id || ''))
        : String(b.id || '').localeCompare(String(a.id || ''));
    }

    if (sortField === 'views' || sortField === 'importance') {
      const valA = Number(a[sortField]) || 0;
      const valB = Number(b[sortField]) || 0;
      return sortDir === 'asc' ? valA - valB : valB - valA;
    }

    const valA = String(a[sortField] || '');
    const valB = String(b[sortField] || '');
    return sortDir === 'asc'
      ? valA.localeCompare(valB, 'ko')
      : valB.localeCompare(valA, 'ko');
  });

  // Pagination
  const totalPages = Math.ceil(sortedIdeas.length / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedIdeas = sortedIdeas.slice(
    (validCurrentPage - 1) * pageSize,
    validCurrentPage * pageSize
  );

  // Main Tag statistics
  const tagFreq = new Map<string, number>();
  ideas.forEach((idea) => {
    if (idea.tags && idea.tags.length > 0) {
      const mainTag = idea.tags[0];
      tagFreq.set(mainTag, (tagFreq.get(mainTag) || 0) + 1);
    }
  });

  const mainTagList = Array.from(tagFreq.entries()).map(([name, count]) => ({ name, count }));
  if (tagSortOrder === 'alphabetical') {
    mainTagList.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  } else {
    mainTagList.sort((a, b) => b.count - a.count);
  }

  const matchingMainTags = mainTagList.filter((t) =>
    t.name.toLowerCase().includes(tagSearchQuery.trim().toLowerCase())
  );

  // Sub-tag stats for selected main tag
  const subTagFreq = new Map<string, number>();
  if (selectedTags.length > 0) {
    ideas.forEach((idea) => {
      if (selectedTags.every((st) => idea.tags?.includes(st))) {
        idea.tags.forEach((t) => {
          if (!selectedTags.includes(t)) {
            subTagFreq.set(t, (subTagFreq.get(t) || 0) + 1);
          }
        });
      }
    });
  }
  const subTagList = Array.from(subTagFreq.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Connected tag network on hover
  const getConnectedTags = (targetTag: string) => {
    if (!targetTag) return [];
    const coMap = new Map<string, { count: number; titles: string[] }>();
    ideas.forEach((idea) => {
      if (idea.tags?.includes(targetTag)) {
        idea.tags.forEach((other) => {
          if (other !== targetTag) {
            const ex = coMap.get(other) || { count: 0, titles: [] };
            ex.count += 1;
            if (ex.titles.length < 3) ex.titles.push(idea.title);
            coMap.set(other, ex);
          }
        });
      }
    });

    return Array.from(coMap.entries())
      .map(([name, data]) => ({ name, count: data.count, titles: data.titles }))
      .sort((a, b) => b.count - a.count);
  };

  const connectedNetwork = hoveredTag ? getConnectedTags(hoveredTag) : [];

  // Batch toggle
  const toggleCheck = (id: string) => {
    if (checkedIds.includes(id)) {
      setCheckedIds(checkedIds.filter((i) => i !== id));
    } else {
      setCheckedIds([...checkedIds, id]);
    }
  };

  const toggleSelectAllPage = () => {
    const pageIds = paginatedIdeas.map((i) => i.id);
    const allChecked = pageIds.every((id) => checkedIds.includes(id));
    if (allChecked) {
      setCheckedIds(checkedIds.filter((id) => !pageIds.includes(id)));
    } else {
      setCheckedIds(Array.from(new Set([...checkedIds, ...pageIds])));
    }
  };

  const handleBatchDelete = () => {
    if (checkedIds.length === 0) return;
    onBatchDeleteIdeas(checkedIds);
    setCheckedIds([]);
  };

  const resetAllFilters = () => {
    onSearchChange('');
    onSelectTags([]);
    onSelectSubTags([]);
    setSelectedSource(null);
    setSelectedSourceCategory('all');
    setIsPhotoFilterActive(false);
    setCurrentPage(1);
  };

  // Helper for source badges (special support for YouTube videos)
  const renderSourceBadge = (idea: Idea) => {
    const sourceStr = idea.sourceUrl;
    if (!sourceStr) return null;
    const clean = cleanSourceTitle(sourceStr);
    if (!clean) return null;

    const mainTitle = extractMainBookTitle(sourceStr);
    const type = getSourceType(sourceStr);

    // YouTube Video Link: show dedicated red badge with play button
    const ytVideoId = extractYouTubeVideoId(sourceStr);
    if (ytVideoId) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveYouTubeVideo({
              videoId: ytVideoId,
              title: idea.title,
              videoUrl: sourceStr.startsWith('http') ? sourceStr : `https://youtu.be/${ytVideoId}`,
              idea,
            });
          }}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-all cursor-pointer shrink-0 shadow-2xs group/yt"
          title="클릭하여 유튜브 영상 바로 시청"
        >
          <div className="w-3.5 h-3.5 rounded bg-red-600 flex items-center justify-center text-white shrink-0 group-hover/yt:scale-110 transition-transform">
            <Play className="w-2 h-2 fill-white ml-0.5" />
          </div>
          <span className="font-extrabold text-red-600">YouTube</span>
          <span className="max-w-[120px] truncate text-red-950 font-medium">
            {clean.includes('youtu') ? '영상 시청' : clean}
          </span>
        </button>
      );
    }

    if (type === 'link') {
      const href = clean.startsWith('www.') ? `https://${clean}` : clean;
      return (
        <a
          href={href.startsWith('http') ? href : `https://${href}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shrink-0"
          title="원문 링크"
        >
          <ExternalLink className="w-3 h-3" />
          <span className="max-w-[120px] truncate">{cleanQuery ? renderHighlightedText(clean, cleanQuery) : clean}</span>
        </a>
      );
    }

    if (type === 'book') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSource((prev) => (prev === mainTitle ? null : mainTitle));
          }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 ${
            selectedSource === mainTitle
              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
          }`}
          title={`클릭하여 '${mainTitle}' 메모만 모아보기`}
        >
          <Book className="w-3 h-3 text-amber-600" />
          <span className="max-w-[120px] truncate">{cleanQuery ? renderHighlightedText(clean, cleanQuery) : clean}</span>
        </button>
      );
    }

    if (type === 'general') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSource((prev) => (prev === clean ? null : clean));
          }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 ${
            selectedSource === clean
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
          }`}
          title="클릭하여 이 문서 메모만 모아보기"
        >
          <FileText className="w-3 h-3 text-emerald-600" />
          <span className="max-w-[120px] truncate">{cleanQuery ? renderHighlightedText(clean, cleanQuery) : clean}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedSource((prev) => (prev === clean ? null : clean));
        }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 ${
          selectedSource === clean
            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
        }`}
        title="클릭하여 이 출처 메모만 모아보기"
      >
        <Lightbulb className="w-3 h-3 text-indigo-600" />
        <span className="max-w-[120px] truncate">{cleanQuery ? renderHighlightedText(clean, cleanQuery) : clean}</span>
      </button>
    );
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
      
      {/* Left Feed Column */}
      <div className="flex flex-col gap-5">
        
        {/* Toolbar Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-sans tracking-tight">
                Idea Results
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                총 {filteredIdeas.length}개 검색됨 (전체 {ideas.length}개)
              </p>
            </div>

            {onOpenRegisterModal && (
              <button
                onClick={onOpenRegisterModal}
                title="등록"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>등록</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Photography Special Filter Button */}
            <button
              type="button"
              onClick={() => {
                setIsPhotoFilterActive(!isPhotoFilterActive);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                isPhotoFilterActive
                  ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-200'
                  : 'bg-white hover:bg-amber-50/80 text-slate-700 border border-slate-200 hover:border-amber-300'
              }`}
              title="사진, 카메라, 렌즈, 촬영팁 관련 지식만 모아보기"
            >
              <Camera className={`w-3.5 h-3.5 ${isPhotoFilterActive ? 'text-white' : 'text-amber-600'}`} />
              <span>📷 사진·촬영 모아보기</span>
              {isPhotoFilterActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5 animate-pulse" />
              )}
            </button>

            {checkedIds.length > 0 && (
              <div className="flex items-center gap-2">
                {onOpenMergeModal && (
                  <button
                    onClick={() => {
                      const selected = ideas.filter((i) => checkedIds.includes(i.id));
                      onOpenMergeModal(selected);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>선택 노트 하나로 통합 ({checkedIds.length})</span>
                  </button>
                )}

                <button
                  onClick={() => setDeleteTarget({ type: 'batch', ids: checkedIds })}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>선택 삭제 ({checkedIds.length})</span>
                </button>
              </div>
            )}

            {(searchQuery || selectedTags.length > 0 || selectedSubTags.length > 0 || selectedSource || activeSourceCategory !== 'all') && (
              <button
                onClick={resetAllFilters}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                필터 해제
              </button>
            )}

            {/* Export CSV/JSON button */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs font-bold text-slate-700">
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <button onClick={() => onExportData('json')} className="hover:text-blue-600 cursor-pointer">JSON</button>
              <span className="text-slate-300">•</span>
              <button onClick={() => onExportData('csv')} className="hover:text-blue-600 cursor-pointer">CSV</button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="bg-transparent text-slate-800 font-extrabold outline-none cursor-pointer"
              >
                <option value="date">날짜순</option>
                <option value="views">조회수순</option>
                <option value="importance">중요도순</option>
                <option value="title">제목순</option>
              </select>
              <button
                onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                className="text-blue-600 font-extrabold ml-1 hover:text-blue-800 cursor-pointer"
                title="정렬 방향 전환"
              >
                {sortDir === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>
        </div>

        {/* Source Category Extraction Bar (전체, 웹링크, 도서, 문서, 메모) */}
        <div className="bg-slate-50/90 border border-slate-200/90 p-2 sm:p-2.5 rounded-2xl flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-black text-slate-700 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>출처 추출:</span>
            </span>

            <button
              type="button"
              onClick={() => {
                setSelectedSourceCategory('all');
                if (queryCategory !== 'all') onSearchChange(cleanQuery);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border ${
                activeSourceCategory === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span>전체</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                activeSourceCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 font-bold'
              }`}>
                {sourceCategoryCounts.all}
              </span>
            </button>

            {SOURCE_CATEGORIES.map((cat) => {
              const isSelected = activeSourceCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSourceCategory('all');
                      if (queryCategory !== 'all') onSearchChange(cleanQuery);
                    } else {
                      setSelectedSourceCategory(cat.key);
                    }
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isSelected ? cat.activeClass : cat.inactiveClass
                  }`}
                  title={`출처가 '${cat.label}'인 지식만 추출 (${cat.tag})`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {sourceCategoryCounts[cat.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-400 font-medium hidden md:flex items-center gap-1">
            <span>검색창에</span>
            <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-mono text-[10px]">[도서]</code>
            <span>입력 시 바로 추출</span>
          </div>
        </div>

        {/* Page Select All Toggle Bar */}
        {paginatedIdeas.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-semibold">
            <button
              onClick={toggleSelectAllPage}
              className="flex items-center gap-1.5 hover:text-slate-800 cursor-pointer"
            >
              {paginatedIdeas.every((i) => checkedIds.includes(i.id)) ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>현재 페이지 전체 선택</span>
            </button>
            <span>{validCurrentPage} / {totalPages} 페이지</span>
          </div>
        )}

        {/* Book Shelf Active Banner */}
        {selectedSource && (
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-base shadow-2xs shrink-0">
                📚
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
                    도서·출처 서재 모아보기
                  </span>
                  <span className="text-xs text-amber-800 font-bold">
                    총 {filteredIdeas.length}편의 메모
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-amber-950 mt-0.5">
                  {selectedSource}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onOpenContinuousReading && filteredIdeas.length > 0 && (
                <button
                  onClick={() => onOpenContinuousReading(selectedSource, filteredIdeas[0]?.id)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Book className="w-3.5 h-3.5" />
                  <span>📖 전편 연속 읽기 ({filteredIdeas.length}편)</span>
                </button>
              )}

              {onOpenMergeModal && filteredIdeas.length > 1 && (
                <button
                  onClick={() => onOpenMergeModal(filteredIdeas)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>📑 이 출처 메모 하나로 통합</span>
                </button>
              )}

              <button
                onClick={() => setSelectedSource(null)}
                className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>서재 필터 해제</span>
              </button>
            </div>
          </div>
        )}

        {/* Idea Feed List */}
        <div className="flex flex-col space-y-4">
          {paginatedIdeas.length === 0 ? (
            <div className="text-center py-16 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 text-slate-400">
              <Filter className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold">검색 조건에 일치하는 지식이 없습니다.</p>
              <button
                onClick={resetAllFilters}
                className="mt-3 text-xs font-extrabold text-blue-600 hover:underline cursor-pointer"
              >
                전체 지식 다시 보기
              </button>
            </div>
          ) : (
            paginatedIdeas.map((idea) => {
              const isChecked = checkedIds.includes(idea.id);

              return (
                <div
                  key={idea.id}
                  className="group bg-white border border-slate-200/90 hover:border-blue-300 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all relative"
                >
                  <div className="flex flex-col gap-2">
                    
                    {/* Top Row: Checkbox + Title + Stars + Source + Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCheck(idea.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0 mt-0.5"
                        />

                        <h3
                          onClick={() => onOpenPreviewModal(idea.id)}
                          className="text-base sm:text-lg md:text-xl font-bold text-[#1a0dab] hover:underline cursor-pointer tracking-tight line-clamp-2"
                        >
                          {renderHighlightedText(idea.title, searchQuery)}
                        </h3>

                        {/* Stars */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          {Array.from({ length: idea.importance || 1 }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>

                        {renderSourceBadge(idea)}
                      </div>

                      {/* Action buttons */}
                      <div className="sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => onStartEditIdea(idea.id)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="수정"
                        >
                          <PenSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ type: 'single', id: idea.id, title: idea.title })}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata line */}
                    <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
                      <span>{formatDate(idea.date, idea.id)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        조회수 {idea.views || 0}회
                      </span>
                    </div>

                    {/* Content snippet & YouTube Thumbnail preview */}
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3.5 my-1">
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Content snippet */}
                        <p
                          onClick={() => onOpenPreviewModal(idea.id)}
                          className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3 cursor-pointer hover:text-slate-900 transition-colors font-normal"
                        >
                          {renderHighlightedText(idea.content || '본문 내용이 비어있습니다.', searchQuery)}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {(idea.tags || []).map((t, idx) => {
                            const isPhotoTag = typeof t === 'string' && (PHOTO_PRESET_TAGS.includes(t) || ['사진', '카메라', '렌즈', '촬영'].some((k) => t.includes(k)));
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (selectedTags.includes(t)) {
                                    onSelectTags(selectedTags.filter((st) => st !== t));
                                  } else {
                                    onSelectTags([t]);
                                  }
                                }}
                                onMouseEnter={() => setHoveredTag(t)}
                                onMouseLeave={() => setHoveredTag(null)}
                                className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-all cursor-pointer flex items-center gap-1 ${
                                  hoveredTag === t
                                    ? 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-200'
                                    : selectedTags.includes(t)
                                      ? 'bg-blue-600 text-white font-bold'
                                      : isPhotoTag
                                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold'
                                        : idx === 0
                                          ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-100 hover:bg-blue-100'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {isPhotoTag && <span className="text-[10px]">📷</span>}
                                <span>#{t}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* YouTube Thumbnail preview (right side) */}
                      {(() => {
                        const youTubeInfo = getIdeaYouTubeInfo(idea);
                        if (!youTubeInfo) return null;
                        return (
                          <div
                            onClick={() =>
                              setActiveYouTubeVideo({
                                videoId: youTubeInfo.videoId,
                                title: idea.title,
                                videoUrl: youTubeInfo.videoUrl,
                                idea,
                              })
                            }
                            className="group/yt relative w-full sm:w-36 md:w-44 aspect-video rounded-xl overflow-hidden shadow-2xs border border-slate-200 hover:border-red-400 cursor-pointer shrink-0 transition-all hover:shadow-md bg-slate-900"
                            title="클릭하여 유튜브 영상 바로 시청"
                          >
                            <img
                              src={youTubeInfo.thumbnailUrl}
                              alt={idea.title}
                              className="w-full h-full object-cover group-hover/yt:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            {/* Dark overlay & Play button */}
                            <div className="absolute inset-0 bg-black/25 group-hover/yt:bg-black/10 flex items-center justify-center transition-colors">
                              <div className="w-9 h-6.5 rounded-lg bg-red-600/90 group-hover/yt:bg-red-600 group-hover/yt:scale-110 flex items-center justify-center text-white shadow-md transition-all">
                                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                              </div>
                            </div>
                            {/* YouTube logo badge */}
                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white font-mono font-bold flex items-center gap-1 shadow-xs">
                              <Youtube className="w-3 h-3 text-red-500 fill-red-500" />
                              <span>YouTube</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4 pb-6">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              const isActive = pageNum === validCurrentPage;
              return (
                <button
                  key={pageNum}
                  onClick={() => {
                    setCurrentPage(pageNum);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`text-sm font-extrabold px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* Right Sidebar Column */}
      <aside className="space-y-6 sticky top-20">
        <div className="bg-slate-100/80 border border-slate-200/80 rounded-2xl p-5 space-y-6 shadow-2xs">
          
          {/* Today Flashback Recommendation */}
          <div>
            {todayRecIdea && (
              <div className="bg-white border border-amber-200/90 rounded-xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-bold text-slate-900 font-sans">오늘 되짚어볼 지식</span>
                  </div>
                  <button
                    onClick={onRefreshTodayRec}
                    className="p-1 text-slate-400 hover:text-amber-600 rounded transition-colors cursor-pointer"
                    title="다른 지식 추천 받기"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h4
                  onClick={() => onOpenPreviewModal(todayRecIdea.id)}
                  className="font-bold text-sm text-slate-900 hover:text-blue-600 cursor-pointer line-clamp-2"
                >
                  {todayRecIdea.title}
                </h4>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                  {todayRecIdea.content}
                </p>

                <button
                  onClick={() => onOpenPreviewModal(todayRecIdea.id)}
                  className="text-xs font-bold text-amber-800 hover:underline pt-1 flex items-center gap-1 cursor-pointer"
                >
                  <span>자세히 보기</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="h-px bg-slate-200"></div>

          {/* Book Shelf (도서 및 출처별 서재) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm font-sans flex items-center gap-1.5">
                <Book className="w-4 h-4 text-amber-600" />
                <span>도서 및 출처 서재 ({sourceStats.length}개)</span>
              </h3>
              {selectedSource && (
                <button
                  onClick={() => setSelectedSource(null)}
                  className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  전체 보기
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {sourceStats.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">등록된 출처가 없습니다.</p>
              ) : (
                sourceStats.map((src, idx) => {
                  const isSelected = selectedSource?.toLowerCase() === src.displayName.toLowerCase();
                  const prevCategory = idx > 0 ? sourceStats[idx - 1].category : null;
                  const isNewCategory = src.category !== prevCategory;
                  const catLabel =
                    src.category === 'book'
                      ? '📚 도서'
                      : src.category === 'document'
                      ? '📄 문서'
                      : src.category === 'memo'
                      ? '💡 메모'
                      : '🔗 웹링크';

                  const formattedName =
                    src.isYouTube && !src.displayName.startsWith('[YouTube]')
                      ? `[YouTube] ${src.displayName}`
                      : src.category === 'book' && !src.displayName.startsWith('[도서]')
                      ? `[도서] ${src.displayName}`
                      : src.category === 'document' && !src.displayName.startsWith('[문서]')
                      ? `[문서] ${src.displayName}`
                      : src.category === 'memo' && !src.displayName.startsWith('[메모]')
                      ? `[메모] ${src.displayName}`
                      : src.displayName;

                  return (
                    <React.Fragment key={src.displayName}>
                      {isNewCategory && (
                        <div className="pt-2.5 pb-1 text-[11px] font-black text-slate-600 flex items-center justify-between border-t border-slate-200/80 first:border-t-0 first:pt-0">
                          <span className="flex items-center gap-1.5">{catLabel}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-medium">
                            {sourceCategoryCounts[src.category]}개
                          </span>
                        </div>
                      )}
                      <button
                        key={src.displayName}
                        onClick={() => setSelectedSource(isSelected ? null : src.displayName)}
                        className={`w-full px-3 py-2 rounded-xl text-xs text-left transition-all cursor-pointer flex items-center justify-between gap-2 border ${
                          isSelected
                            ? 'bg-amber-100 text-amber-950 font-black border-amber-300 shadow-2xs'
                            : 'bg-white hover:bg-slate-50 text-slate-700 font-semibold border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="shrink-0">
                            {src.isYouTube ? (
                              <Youtube className="w-3.5 h-3.5 text-red-600 inline" />
                            ) : src.category === 'book' ? (
                              '📚'
                            ) : src.category === 'document' ? (
                              '📄'
                            ) : src.category === 'memo' ? (
                              '💡'
                            ) : (
                              '🔗'
                            )}
                          </span>
                          <span className="truncate">{formattedName}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-bold ${
                          isSelected ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {src.count}
                        </span>
                      </button>
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>

          <div className="h-px bg-slate-200"></div>

          {/* Integrated Tag Filter & Dropdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm font-sans flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>연관 주제 및 태그</span>
              </h3>
            </div>

            {/* Tag Selector Trigger Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                className="w-full pl-3.5 pr-8 py-2 bg-white border border-slate-300 hover:border-blue-400 rounded-xl text-xs font-bold text-slate-800 shadow-2xs outline-none cursor-pointer transition-all flex items-center justify-between text-left"
              >
                <span className="truncate">
                  {selectedTags.length > 0
                    ? `#${selectedTags.join(', ')} (${filteredIdeas.length}개)`
                    : `🏷️ 전체 주제 / 태그 선택 (${mainTagList.length}개)`}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 absolute right-3 transition-transform ${isTagDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
              </button>

              {/* Tag Dropdown Panel */}
              {isTagDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-2.5">
                  <div className="space-y-2 pb-2.5 border-b border-slate-100">
                    <input
                      type="text"
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      placeholder="태그 검색..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-blue-500"
                    />

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-semibold">정렬</span>
                      <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                        <button
                          onClick={() => setTagSortOrder('count')}
                          className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                            tagSortOrder === 'count' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          개수순
                        </button>
                        <button
                          onClick={() => setTagSortOrder('alphabetical')}
                          className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                            tagSortOrder === 'alphabetical' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          가나다순
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1">
                    <button
                      onClick={() => {
                        onSelectTags([]);
                        onSelectSubTags([]);
                        setIsTagDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-all ${
                        selectedTags.length === 0 ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      🏷️ 전체 주제 보기 (총 {ideas.length}개)
                    </button>

                    {matchingMainTags.map((t) => {
                      const isSelected = selectedTags.includes(t.name);
                      return (
                        <button
                          key={t.name}
                          onClick={() => {
                            if (isSelected) {
                              onSelectTags(selectedTags.filter((st) => st !== t.name));
                            } else {
                              onSelectTags([t.name]);
                            }
                            onSelectSubTags([]);
                            setIsTagDropdownOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                            isSelected ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <span className="truncate">#{t.name}</span>
                          <span className={`text-[10px] font-mono shrink-0 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                            ({t.count}개)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Active Tag Pill */}
            {selectedTags.length > 0 && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-xs">
                <span className="font-extrabold text-blue-900">
                  선택 주제: #{selectedTags.join(', ')}
                </span>
                <button
                  onClick={() => {
                    onSelectTags([]);
                    onSelectSubTags([]);
                  }}
                  className="text-[11px] text-blue-700 hover:text-blue-900 font-extrabold underline cursor-pointer"
                >
                  해제
                </button>
              </div>
            )}

            {/* Sub Tags List */}
            {selectedTags.length > 0 && subTagList.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                <span className="text-[11px] font-bold text-emerald-800">└ 하위 연관 태그</span>
                <div className="flex flex-wrap gap-1.5">
                  {subTagList.map((sub) => {
                    const isSubSelected = selectedSubTags.includes(sub.name);
                    return (
                      <button
                        key={sub.name}
                        onClick={() => {
                          if (isSubSelected) {
                            onSelectSubTags(selectedSubTags.filter((s) => s !== sub.name));
                          } else {
                            onSelectSubTags([...selectedSubTags, sub.name]);
                          }
                        }}
                        onMouseEnter={() => setHoveredTag(sub.name)}
                        onMouseLeave={() => setHoveredTag(null)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          isSubSelected
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        #{sub.name} ({sub.count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Connected Tag Network Box */}
            <div className="mt-4 p-3.5 bg-gradient-to-br from-indigo-50/90 via-blue-50/70 to-slate-50 border border-indigo-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-indigo-900 text-xs font-bold">
                  <Network className="w-3.5 h-3.5 text-indigo-600" />
                  <span>연결 태그 네트워크</span>
                </div>
                {hoveredTag && (
                  <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                    #{hoveredTag}
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-600 leading-relaxed">
                {hoveredTag ? (
                  connectedNetwork.length === 0 ? (
                    <p className="text-[11px] text-indigo-800 bg-white p-2 rounded-xl border border-indigo-100">
                      '#{hoveredTag}' 태그는 다른 태그와 함께 등록된 노드가 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-indigo-900 font-semibold">'#{hoveredTag}'와 함께 포함된 태그들:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {connectedNetwork.map((item) => (
                          <button
                            key={item.name}
                            onClick={() => {
                              onSelectTags([item.name]);
                              onSelectSubTags([]);
                            }}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200 text-indigo-900 transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            title={`함께 포함된 노트: ${item.titles.join(', ')}`}
                          >
                            <span>#{item.name}</span>
                            <span className="text-[10px] text-indigo-600 font-extrabold">({item.count})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-slate-500 font-medium">
                    태그에 마우스를 올리면 연관 태그 네트워크가 여기에 표시됩니다.
                  </p>
                )}
              </div>
            </div>

          </div>

        </div>
      </aside>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="지식 노트 삭제"
        message={
          deleteTarget?.type === 'single'
            ? `'${deleteTarget.title || '선택한 노드'}' 지식 노트를 삭제하시겠습니까?`
            : `선택한 ${checkedIds.length}개의 지식 노트를 정말 삭제하시겠습니까?`
        }
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'single') {
            onDeleteSingleIdea(deleteTarget.id);
          } else {
            onBatchDeleteIdeas(deleteTarget.ids);
            setCheckedIds([]);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <YouTubePlayerModal
        isOpen={activeYouTubeVideo !== null}
        onClose={() => setActiveYouTubeVideo(null)}
        videoId={activeYouTubeVideo?.videoId || ''}
        title={activeYouTubeVideo?.title || ''}
        videoUrl={activeYouTubeVideo?.videoUrl}
        idea={activeYouTubeVideo?.idea}
        onOpenFullNote={onOpenPreviewModal}
      />

    </div>
  );
};
