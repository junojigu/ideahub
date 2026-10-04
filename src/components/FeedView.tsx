import React, { useState, useMemo } from 'react';
import { 
  Sparkles, RotateCw, Filter, ChevronDown, Trash2, ArrowUpDown, 
  Star, Eye, PenSquare, ArrowRight, ExternalLink, Book, FileText, Lightbulb,
  Download, Network, CheckSquare, Square, Plus, Layers, X, Youtube, Play, Camera,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight
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
  
  // Collapsible accordion toggle state for Book & Source shelf categories ('도서'만 기본 펼침)
  const [expandedSourceCategories, setExpandedSourceCategories] = useState<Record<string, boolean>>({
    book: true,
    document: false,
    memo: false,
    link: false,
  });

  const toggleSourceCategory = (catKey: string) => {
    setExpandedSourceCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  const allCategoriesExpanded = Object.values(expandedSourceCategories).every(Boolean);
  const toggleAllSourceCategories = () => {
    const nextState = !allCategoriesExpanded;
    setExpandedSourceCategories({
      book: nextState,
      document: nextState,
      memo: nextState,
      link: nextState,
    });
  };
  
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

  // Pagination (10 pages per group)
  const PAGES_PER_BLOCK = 10;
  const totalPages = Math.ceil(sortedIdeas.length / pageSize) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const paginatedIdeas = sortedIdeas.slice(
    (validCurrentPage - 1) * pageSize,
    validCurrentPage * pageSize
  );

  const currentBlock = Math.floor((validCurrentPage - 1) / PAGES_PER_BLOCK);
  const startPage = currentBlock * PAGES_PER_BLOCK + 1;
  const endPage = Math.min(startPage + PAGES_PER_BLOCK - 1, totalPages);
  const pageNumbers: number[] = [];
  for (let p = startPage; p <= endPage; p++) {
    pageNumbers.push(p);
  }

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

  // Helper for source badges (minimal interactive source filter control)
  const renderSourceBadge = (idea: Idea) => {
    const sourceStr = idea.sourceUrl;
    if (!sourceStr) return null;
    const clean = cleanSourceTitle(sourceStr);
    if (!clean) return null;

    const mainTitle = extractMainBookTitle(sourceStr);
    const type = getSourceType(sourceStr);

    // YouTube Video Link: show compact play control
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
          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-md bg-red-50 hover:bg-red-100 text-red-700 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          title="클릭하여 유튜브 영상 바로 시청"
        >
          <Play className="w-3 h-3 fill-red-600 text-red-600 shrink-0" />
          <span className="max-w-[140px] truncate">
            {clean.includes('youtu') ? 'YouTube 영상' : clean}
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
          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors shrink-0 whitespace-nowrap"
          title="원문 링크"
        >
          <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="max-w-[140px] truncate">{cleanQuery ? renderHighlightedText(clean, cleanQuery) : clean}</span>
        </a>
      );
    }

    const filterTarget = type === 'book' ? mainTitle : clean;
    const isActiveSource = selectedSource === filterTarget;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSelectedSource((prev) => (prev === filterTarget ? null : filterTarget));
        }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
          isActiveSource
            ? 'bg-slate-900 text-white font-semibold'
            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
        }`}
        title={`클릭하여 '${filterTarget}' 메모만 모아보기`}
      >
        {type === 'book' ? (
          <Book className={`w-3 h-3 shrink-0 ${isActiveSource ? 'text-amber-300' : 'text-slate-500'}`} />
        ) : type === 'general' ? (
          <FileText className={`w-3 h-3 shrink-0 ${isActiveSource ? 'text-emerald-300' : 'text-slate-500'}`} />
        ) : (
          <Lightbulb className={`w-3 h-3 shrink-0 ${isActiveSource ? 'text-indigo-300' : 'text-slate-500'}`} />
        )}
        <span className="max-w-[150px] truncate">{cleanQuery ? renderHighlightedText(clean, cleanQuery) : clean}</span>
      </button>
    );
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
      
      {/* Right Feed Column (Main Content Stream) */}
      <div className="flex flex-col gap-4 min-w-0 lg:col-start-2 lg:row-start-1">
        
        {/* Unified Minimal Control & Filter Header */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Segmented Category Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-lg flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSelectedSourceCategory('all');
                setIsPhotoFilterActive(false);
                if (queryCategory !== 'all') onSearchChange(cleanQuery);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeSourceCategory === 'all' && !isPhotoFilterActive
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <span>전체</span>
              <span className="text-[11px] text-slate-400 tabular-nums">{sourceCategoryCounts.all}</span>
            </button>

            {SOURCE_CATEGORIES.map((cat) => {
              const isSelected = activeSourceCategory === cat.key && !isPhotoFilterActive;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    setIsPhotoFilterActive(false);
                    if (isSelected) {
                      setSelectedSourceCategory('all');
                      if (queryCategory !== 'all') onSearchChange(cleanQuery);
                    } else {
                      setSelectedSourceCategory(cat.key);
                    }
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{sourceCategoryCounts[cat.key]}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setIsPhotoFilterActive(!isPhotoFilterActive);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                isPhotoFilterActive
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
              title="사진, 카메라, 렌즈, 촬영팁 관련 지식만 모아보기"
            >
              <Camera className="w-3.5 h-3.5 text-slate-500" />
              <span>사진</span>
            </button>
          </div>

          {/* Right: Sort, Export, Reset & Primary Action */}
          <div className="flex items-center gap-2 flex-wrap">
            {(searchQuery || selectedTags.length > 0 || selectedSubTags.length > 0 || selectedSource || activeSourceCategory !== 'all' || isPhotoFilterActive) && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                필터 초기화
              </button>
            )}

            {/* Sort Selector */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg text-xs text-slate-700">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as any)}
                className="bg-transparent text-slate-800 font-medium outline-none cursor-pointer"
              >
                <option value="date">날짜순</option>
                <option value="views">조회수순</option>
                <option value="importance">중요도순</option>
                <option value="title">제목순</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                className="text-slate-500 hover:text-slate-900 font-semibold ml-0.5 cursor-pointer"
                title="정렬 방향 전환"
              >
                {sortDir === 'desc' ? '↓' : '↑'}
              </button>
            </div>

            {/* Export CSV/JSON */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600">
              <Download className="w-3 h-3 text-slate-400 mr-0.5" />
              <button type="button" onClick={() => onExportData('json')} className="hover:text-slate-900 cursor-pointer">JSON</button>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <button type="button" onClick={() => onExportData('csv')} className="hover:text-slate-900 cursor-pointer">CSV</button>
            </div>

            {onOpenRegisterModal && (
              <button
                type="button"
                onClick={onOpenRegisterModal}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>새 노트</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-bar: Selection Status, Count & Batch Actions */}
        <div className="flex items-center justify-between gap-2 px-1 text-xs text-slate-500">
          <div className="flex items-center gap-3 flex-wrap">
            {paginatedIdeas.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllPage}
                className="flex items-center gap-1.5 hover:text-slate-900 cursor-pointer font-medium"
              >
                {paginatedIdeas.every((i) => checkedIds.includes(i.id)) ? (
                  <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>페이지 선택</span>
              </button>
            )}

            <span className="tabular-nums">
              검색 결과 <strong className="text-slate-800 font-semibold">{filteredIdeas.length}</strong>편
            </span>

            {checkedIds.length > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                {onOpenMergeModal && (
                  <button
                    type="button"
                    onClick={() => {
                      const selected = ideas.filter((i) => checkedIds.includes(i.id));
                      onOpenMergeModal(selected);
                    }}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                  >
                    <Layers className="w-3 h-3" />
                    <span>노트 통합 ({checkedIds.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDeleteTarget({ type: 'batch', ids: checkedIds })}
                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>삭제 ({checkedIds.length})</span>
                </button>
              </div>
            )}
          </div>

          {paginatedIdeas.length > 0 && (
            <span className="tabular-nums text-slate-400">
              {validCurrentPage} / {totalPages} 페이지
            </span>
          )}
        </div>

        {/* Active Source / Book Shelf Contextual Banner */}
        {selectedSource && (
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                <span>선택된 출처</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-700">총 {filteredIdeas.length}편의 노트</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {selectedSource}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onOpenContinuousReading && filteredIdeas.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenContinuousReading(selectedSource, filteredIdeas[0]?.id)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Book className="w-3.5 h-3.5" />
                  <span>연속 읽기 ({filteredIdeas.length}편)</span>
                </button>
              )}

              {onOpenMergeModal && filteredIdeas.length > 1 && (
                <button
                  type="button"
                  onClick={() => onOpenMergeModal(filteredIdeas)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>하나로 통합</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="출처 필터 해제"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Minimal Idea Feed List */}
        <div className="flex flex-col space-y-2.5">
          {paginatedIdeas.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200/80 text-slate-400">
              <p className="text-sm font-medium text-slate-600">조건에 일치하는 지식 노트가 없습니다.</p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-2.5 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                전체 노트 다시 보기
              </button>
            </div>
          ) : (
            paginatedIdeas.map((idea) => {
              const isChecked = checkedIds.includes(idea.id);
              const youTubeInfo = getIdeaYouTubeInfo(idea);

              return (
                <article
                  key={idea.id}
                  className={`group bg-white border rounded-xl p-4 sm:p-5 transition-colors relative ${
                    isChecked
                      ? 'border-slate-900 bg-slate-50/40'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2 w-full">
                      {/* Header Row: Checkbox + Title + Importance + Date & Hover Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheck(idea.id)}
                            className="w-3.5 h-3.5 rounded text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900 shrink-0"
                          />

                          <h3
                            onClick={() => onOpenPreviewModal(idea.id)}
                            className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer tracking-tight line-clamp-1"
                          >
                            {renderHighlightedText(idea.title, searchQuery)}
                          </h3>

                          {(idea.importance || 1) > 1 && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600 shrink-0 tabular-nums"
                              title={`중요도 ${idea.importance}`}
                            >
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{idea.importance}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400 tabular-nums">
                            {formatDate(idea.date, idea.id)}
                          </span>

                          <div className="sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-opacity flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => onStartEditIdea(idea.id)}
                              className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="수정"
                            >
                              <PenSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ type: 'single', id: idea.id, title: idea.title })}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Body Content Snippet */}
                      <p
                        onClick={() => onOpenPreviewModal(idea.id)}
                        className="text-sm text-slate-600 leading-relaxed line-clamp-2 cursor-pointer hover:text-slate-900 transition-colors pl-6"
                      >
                        {renderHighlightedText(idea.content || '본문 내용이 비어있습니다.', searchQuery)}
                      </p>

                      {/* Footer Row: Source + Clean Tag Links + View Count */}
                      <div className="flex items-center justify-between gap-3 pt-1 pl-6 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          {renderSourceBadge(idea)}

                          {(idea.tags || []).map((t, idx) => {
                            const isSelected = selectedTags.includes(t);
                            const isHovered = hoveredTag === t;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    onSelectTags(selectedTags.filter((st) => st !== t));
                                  } else {
                                    onSelectTags([t]);
                                  }
                                }}
                                onMouseEnter={() => setHoveredTag(t)}
                                onMouseLeave={() => setHoveredTag(null)}
                                className={`text-xs transition-colors cursor-pointer whitespace-nowrap ${
                                  isSelected
                                    ? 'text-blue-600 font-bold underline'
                                    : isHovered
                                      ? 'text-slate-900 font-semibold'
                                      : 'text-slate-500 hover:text-slate-800 font-medium'
                                }`}
                              >
                                #{t}
                              </button>
                            );
                          })}
                        </div>

                        <span className="text-xs text-slate-400 tabular-nums shrink-0">
                          열람 {idea.views || 0}
                        </span>
                      </div>
                    </div>

                    {/* Optional YouTube Thumbnail on Right */}
                    {youTubeInfo && (
                      <div
                        onClick={() =>
                          setActiveYouTubeVideo({
                            videoId: youTubeInfo.videoId,
                            title: idea.title,
                            videoUrl: youTubeInfo.videoUrl,
                            idea,
                          })
                        }
                        className="group/yt relative w-full sm:w-36 aspect-video rounded-lg overflow-hidden border border-slate-200 cursor-pointer shrink-0 bg-slate-900"
                        title="클릭하여 유튜브 영상 바로 시청"
                      >
                        <img
                          src={youTubeInfo.thumbnailUrl}
                          alt={idea.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover/yt:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/25 group-hover/yt:bg-black/10 flex items-center justify-center transition-colors">
                          <div className="w-8 h-6 rounded-md bg-red-600/95 flex items-center justify-center text-white shadow-sm">
                            <Play className="w-3 h-3 fill-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Clean Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 pt-4 pb-8 select-none flex-wrap tabular-nums">
            <button
              type="button"
              onClick={() => {
                setCurrentPage(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={validCurrentPage === 1}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="처음 페이지"
              aria-label="처음 페이지"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentPage(Math.max(1, validCurrentPage - 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={validCurrentPage === 1}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="이전 페이지"
              aria-label="이전 페이지"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1 mx-1">
              {pageNumbers.map((pageNum) => {
                const isActive = pageNum === validCurrentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => {
                      setCurrentPage(pageNum);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`min-w-8 h-8 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setCurrentPage(Math.min(totalPages, validCurrentPage + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={validCurrentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="다음 페이지"
              aria-label="다음 페이지"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentPage(totalPages);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={validCurrentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="끝 페이지"
              aria-label="끝 페이지"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      </div>

      {/* Left Sidebar Column (Single-Elevation Minimal Navigation) */}
      <aside className="space-y-4 sticky top-20 min-w-0 lg:col-start-1 lg:row-start-1">
        
        {/* 1. Today Flashback Recommendation */}
        {todayRecIdea && (
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 tracking-tight">
                오늘 되짚어볼 지식
              </span>
              <button
                type="button"
                onClick={onRefreshTodayRec}
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                title="다른 지식 추천 받기"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <h4
              onClick={() => onOpenPreviewModal(todayRecIdea.id)}
              className="font-bold text-sm text-slate-900 hover:text-blue-600 cursor-pointer line-clamp-2 transition-colors"
            >
              {todayRecIdea.title}
            </h4>

            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
              {todayRecIdea.content}
            </p>
          </div>
        )}

        {/* 2. Book & Source Shelf (Collapsible Accordion, Single-Elevation) */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-xs tracking-tight">
              도서 및 출처 서재 <span className="text-slate-400 font-normal tabular-nums">({sourceStats.length})</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAllSourceCategories}
                className="text-[11px] text-slate-400 hover:text-slate-800 font-medium transition-colors cursor-pointer"
              >
                {allCategoriesExpanded ? '모두 접기' : '모두 펼치기'}
              </button>
              {selectedSource && (
                <button
                  type="button"
                  onClick={() => setSelectedSource(null)}
                  className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  해제
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto -mx-1 px-1">
            {sourceStats.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">등록된 출처가 없습니다.</p>
            ) : (
              ([
                { category: 'book' as const, label: '도서' },
                { category: 'document' as const, label: '문서' },
                { category: 'memo' as const, label: '메모' },
                { category: 'link' as const, label: '웹링크' },
              ]).map((sec) => {
                const sectionItems = sourceStats.filter((s) => s.category === sec.category);
                const isExpanded = !!expandedSourceCategories[sec.category];

                return (
                  <div key={sec.category} className="py-1.5 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => toggleSourceCategory(sec.category)}
                      className="w-full py-1.5 px-1 text-slate-800 hover:text-slate-950 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                            isExpanded ? 'rotate-0' : '-rotate-90'
                          }`}
                        />
                        <span>{sec.label}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums font-normal">
                        {sectionItems.length}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-1 space-y-0.5 pl-3">
                        {sectionItems.length === 0 ? (
                          <p className="text-[11px] text-slate-400 py-1 px-2">
                            등록된 {sec.label} 항목 없음
                          </p>
                        ) : (
                          sectionItems.map((src) => {
                            const isSelected =
                              selectedSource?.toLowerCase() === src.displayName.toLowerCase();

                            return (
                              <button
                                key={src.displayName}
                                type="button"
                                onClick={() =>
                                  setSelectedSource(isSelected ? null : src.displayName)
                                }
                                className={`w-full px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-slate-900 text-white font-semibold'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                                }`}
                                title={src.displayName}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  {src.isYouTube && (
                                    <Youtube className={`w-3 h-3 shrink-0 ${isSelected ? 'text-red-300' : 'text-red-600'}`} />
                                  )}
                                  <span className="truncate">{src.displayName}</span>
                                </div>
                                <span
                                  className={`text-[11px] shrink-0 tabular-nums ${
                                    isSelected ? 'text-slate-300' : 'text-slate-400'
                                  }`}
                                >
                                  {src.count}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 3. Integrated Tag Filter & Network */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-xs tracking-tight">
              주제 및 태그 <span className="text-slate-400 font-normal tabular-nums">({mainTagList.length})</span>
            </h3>
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onSelectTags([]);
                  onSelectSubTags([]);
                }}
                className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                해제
              </button>
            )}
          </div>

          {/* Tag Selector Dropdown Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
              className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg text-xs font-medium text-slate-700 outline-none cursor-pointer transition-colors flex items-center justify-between text-left"
            >
              <span className="truncate">
                {selectedTags.length > 0
                  ? `#${selectedTags.join(', ')} (${filteredIdeas.length})`
                  : '전체 태그에서 선택...'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isTagDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 space-y-2">
                <div className="space-y-1.5 pb-2 border-b border-slate-100">
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    placeholder="태그 검색..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:border-slate-900"
                  />

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">정렬</span>
                    <div className="flex items-center p-0.5 bg-slate-100 rounded-md">
                      <button
                        type="button"
                        onClick={() => setTagSortOrder('count')}
                        className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                          tagSortOrder === 'count' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                        }`}
                      >
                        빈도순
                      </button>
                      <button
                        type="button"
                        onClick={() => setTagSortOrder('alphabetical')}
                        className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                          tagSortOrder === 'alphabetical' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                        }`}
                      >
                        가나다순
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTags([]);
                      onSelectSubTags([]);
                      setIsTagDropdownOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left cursor-pointer transition-colors ${
                      selectedTags.length === 0 ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    전체 보기 ({ideas.length})
                  </button>

                  {matchingMainTags.map((t) => {
                    const isSelected = selectedTags.includes(t.name);
                    return (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            onSelectTags(selectedTags.filter((st) => st !== t.name));
                          } else {
                            onSelectTags([t.name]);
                          }
                          onSelectSubTags([]);
                          setIsTagDropdownOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected ? 'bg-slate-900 text-white font-semibold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="truncate">#{t.name}</span>
                        <span className={`text-[11px] tabular-nums shrink-0 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                          {t.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sub Tags List */}
          {selectedTags.length > 0 && subTagList.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <span className="text-[11px] font-medium text-slate-400">연관 하위 태그</span>
              <div className="flex flex-wrap gap-1">
                {subTagList.map((sub) => {
                  const isSubSelected = selectedSubTags.includes(sub.name);
                  return (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() => {
                        if (isSubSelected) {
                          onSelectSubTags(selectedSubTags.filter((s) => s !== sub.name));
                        } else {
                          onSelectSubTags([...selectedSubTags, sub.name]);
                        }
                      }}
                      onMouseEnter={() => setHoveredTag(sub.name)}
                      onMouseLeave={() => setHoveredTag(null)}
                      className={`text-xs px-2 py-0.5 rounded-md transition-colors cursor-pointer tabular-nums ${
                        isSubSelected
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                      }`}
                    >
                      #{sub.name} <span className="opacity-60">{sub.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contextual Connected Tag Network (Shown cleanly on hover) */}
          {hoveredTag && connectedNetwork.length > 0 && (
            <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>'#{hoveredTag}' 연관 태그</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {connectedNetwork.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      onSelectTags([item.name]);
                      onSelectSubTags([]);
                    }}
                    className="text-xs px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-200/80 text-slate-700 transition-colors cursor-pointer tabular-nums"
                    title={`함께 포함된 노트: ${item.titles.join(', ')}`}
                  >
                    #{item.name} <span className="opacity-60">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
