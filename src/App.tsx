import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { FeedView } from './components/FeedView';
import { GraphView } from './components/GraphView';
import { AiChatView } from './components/AiChatView';
import { EBookReaderModal } from './components/EBookReaderModal';
import { RegisterEditModal } from './components/RegisterEditModal';
import { CreativeSynthesisModal } from './components/CreativeSynthesisModal';
import { SettingsModal } from './components/SettingsModal';
import { OwnerAuthModal } from './components/OwnerAuthModal';
import { DEFAULT_IDEAS } from './data/defaultIdeas';
import { Idea, GasConfig, SyncStatus } from './types';

const STORAGE_KEY_IDEAS = 'ideahub_vault_ideas_v2';
const STORAGE_KEY_RECENT = 'ideahub_vault_recent_v2';
const STORAGE_KEY_GAS_URL = 'ideahub_vault_gas_url_v2';

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyTP0hfXvAKpmC1USIytbGBO3Mrs1KK_36aeIaDi6Mo5R_nwGmo4Ln_XknsyEWjJxQz/exec';

export default function App() {
  const [ideas, setIdeas] = useState<Idea[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_IDEAS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse local storage ideas:', e);
      }
    }
    return DEFAULT_IDEAS;
  });

  const [recentViewedIds, setRecentViewedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_RECENT);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse recent ids:', e);
      }
    }
    return [];
  });

  const [gasConfig, setGasConfig] = useState<GasConfig>(() => {
    const savedUrl = localStorage.getItem(STORAGE_KEY_GAS_URL) || DEFAULT_GAS_URL;
    return {
      gasUrl: savedUrl,
      spreadsheetId: '1ObuXFixOOAclKpymPguwWfllJyCA1T457k35hwP4R30',
      autoSync: true,
    };
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: false,
    isSyncing: false,
  });

  const [currentTab, setCurrentTab] = useState<'home' | 'preview' | 'graph' | 'chat'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSubTags, setSelectedSubTags] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [previewIdeaId, setPreviewIdeaId] = useState<string | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [isCreativeModalOpen, setIsCreativeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isOwnerAuthModalOpen, setIsOwnerAuthModalOpen] = useState(false);
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState(false);
  const [remoteOwnerPin, setRemoteOwnerPin] = useState<string>('');
  const [todayRecIdea, setTodayRecIdea] = useState<Idea | null>(null);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_IDEAS, JSON.stringify(ideas));
  }, [ideas]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(recentViewedIds));
  }, [recentViewedIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GAS_URL, gasConfig.gasUrl);
  }, [gasConfig.gasUrl]);

  // Load / Sync ideas from Google Apps Script Proxy
  const syncWithGas = useCallback(async () => {
    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

    try {
      const response = await fetch('/api/gas/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getIdeasAndAnalysis',
          gasUrl: gasConfig.gasUrl,
        }),
      });

      if (!response.ok) throw new Error('GAS proxy request failed');

      const data = await response.json();

      // Process setting sheet settings automatically
      if (data && data.settings) {
        if (data.settings.deployUrl && typeof data.settings.deployUrl === 'string' && data.settings.deployUrl.startsWith('https://script.google.com')) {
          const freshUrl = data.settings.deployUrl.trim();
          setGasConfig((prev) => {
            if (prev.gasUrl !== freshUrl) {
              localStorage.setItem(STORAGE_KEY_GAS_URL, freshUrl);
              return { ...prev, gasUrl: freshUrl };
            }
            return prev;
          });
        }
        if (data.settings.ownerPin) {
          setRemoteOwnerPin(String(data.settings.ownerPin).trim());
        }
      }

      if (data && Array.isArray(data.ideas) && data.ideas.length > 0) {
        setIdeas(data.ideas);
        setSyncStatus({
          connected: true,
          isSyncing: false,
          lastSyncedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          message: '구글 스프레드시트와 성공적으로 동기화되었습니다.',
        });
      } else {
        setSyncStatus({
          connected: true,
          isSyncing: false,
          lastSyncedAt: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          message: '시트에 연결되었으나 보관된 데이터가 없습니다.',
        });
      }
    } catch (error: any) {
      console.warn('GAS Sync warning:', error?.message);
      setSyncStatus({
        connected: false,
        isSyncing: false,
        message: '시트 동기화 실패 (로컬 데이터로 작동합니다)',
      });
    }
  }, [gasConfig.gasUrl]);

  // Initial sync attempt
  useEffect(() => {
    syncWithGas();
  }, [syncWithGas]);

  // Refresh Today Recommendation
  const refreshTodayRecommendation = useCallback(() => {
    if (ideas.length === 0) return;
    const randomIdx = Math.floor(Math.random() * ideas.length);
    setTodayRecIdea(ideas[randomIdx]);
  }, [ideas]);

  useEffect(() => {
    if (ideas.length > 0 && !todayRecIdea) {
      refreshTodayRecommendation();
    }
  }, [ideas, todayRecIdea, refreshTodayRecommendation]);

  // Record viewed idea
  const handleOpenPreviewModal = (id: string) => {
    setPreviewIdeaId(id);

    // Update recent viewed list
    setRecentViewedIds((prev) => [id, ...prev.filter((i) => i !== id)].slice(0, 10));

    // Increment view count locally & in GAS
    setIdeas((prev) =>
      prev.map((item) => {
        if (String(item.id) === String(id)) {
          return { ...item, views: (item.views || 0) + 1 };
        }
        return item;
      })
    );

    fetch('/api/gas/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'incrementViewCount',
        id,
        gasUrl: gasConfig.gasUrl,
      }),
    }).catch((err) => console.warn('Increment view error:', err));
  };

  // Open Settings Handler with Owner Auth Check
  const handleOpenSettings = () => {
    if (isOwnerAuthenticated) {
      setIsSettingsModalOpen(true);
    } else {
      setIsOwnerAuthModalOpen(true);
    }
  };

  // Save or Update Idea
  const handleSaveIdea = (ideaData: Partial<Idea>) => {
    const isEdit = Boolean(ideaData.id);

    if (isEdit) {
      // Update
      setIdeas((prev) =>
        prev.map((item) => {
          if (String(item.id) === String(ideaData.id)) {
            return {
              ...item,
              ...ideaData,
            } as Idea;
          }
          return item;
        })
      );

      // Call GAS Proxy async
      fetch('/api/gas/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateIdea',
          id: ideaData.id,
          title: ideaData.title,
          content: ideaData.content,
          tags: (ideaData.tags || []).join(','),
          sourceUrl: ideaData.sourceUrl || '',
          importance: ideaData.importance || 1,
          gasUrl: gasConfig.gasUrl,
        }),
      }).catch((err) => console.warn('GAS Update Error:', err));
    } else {
      // Create New
      const newId = `ID_${Date.now()}`;
      const newDate = new Date().toISOString().split('T')[0];

      const newIdea: Idea = {
        id: newId,
        date: newDate,
        title: ideaData.title || '새 지식 노트',
        content: ideaData.content || '',
        tags: ideaData.tags || ['일반'],
        sourceUrl: ideaData.sourceUrl || '',
        importance: ideaData.importance || 1,
        views: 1,
      };

      setIdeas((prev) => [newIdea, ...prev]);

      fetch('/api/gas/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveIdea',
          title: newIdea.title,
          content: newIdea.content,
          tags: newIdea.tags.join(','),
          sourceUrl: newIdea.sourceUrl,
          importance: newIdea.importance,
          gasUrl: gasConfig.gasUrl,
        }),
      }).catch((err) => console.warn('GAS Save Error:', err));
    }

    setEditingIdea(null);
    setCurrentTab('preview');
  };

  // Delete Idea
  const handleDeleteSingleIdea = (id: string) => {
    setIdeas((prev) => prev.filter((i) => String(i.id) !== String(id)));
    setRecentViewedIds((prev) => prev.filter((i) => i !== id));

    fetch('/api/gas/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deleteIdea',
        id,
        gasUrl: gasConfig.gasUrl,
      }),
    }).catch((err) => console.warn('GAS Delete Error:', err));
  };

  // Batch Delete Ideas
  const handleBatchDeleteIdeas = (ids: string[]) => {
    if (!confirm(`선택한 ${ids.length}개의 지식을 영구 삭제하시겠습니까?`)) return;

    setIdeas((prev) => prev.filter((i) => !ids.includes(String(i.id))));
    setRecentViewedIds((prev) => prev.filter((i) => !ids.includes(i)));

    ids.forEach((id) => {
      fetch('/api/gas/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteIdea',
          id,
          gasUrl: gasConfig.gasUrl,
        }),
      }).catch((err) => console.warn('GAS Batch Delete Error:', err));
    });
  };

  // Data Export Handler
  const handleExportData = (format: 'json' | 'csv') => {
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(ideas, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `IdeaHub_Knowledge_Vault_${timestamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else if (format === 'csv') {
      const headers = ['ID', 'Date', 'Title', 'Content', 'Tags', 'Source_URL', 'Importance', 'Views'];
      const csvRows = [
        headers.join(','),
        ...ideas.map((i) =>
          [
            `"${i.id}"`,
            `"${i.date}"`,
            `"${(i.title || '').replace(/"/g, '""')}"`,
            `"${(i.content || '').replace(/"/g, '""')}"`,
            `"${(i.tags || []).join(';')}"`,
            `"${(i.sourceUrl || '').replace(/"/g, '""')}"`,
            i.importance || 1,
            i.views || 0,
          ].join(',')
        ),
      ];

      const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csvRows.join('\n'));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', csvContent);
      downloadAnchor.setAttribute('download', `IdeaHub_Knowledge_Vault_${timestamp}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  // Data Import Handler
  const handleImportData = (jsonContent: string) => {
    try {
      const parsed = JSON.parse(jsonContent);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setIdeas(parsed);
        alert(`성공적으로 ${parsed.length}개의 지식 노트를 불러왔습니다.`);
      } else {
        alert('올바른 지식 노트 배열 JSON 형식이 아닙니다.');
      }
    } catch (e: any) {
      alert(`JSON 파일 파싱 오류: ${e?.message}`);
    }
  };

  const previewIdea = previewIdeaId ? ideas.find((i) => String(i.id) === String(previewIdeaId)) || null : null;

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Navbar */}
      <Header
        currentTab={currentTab}
        onSwitchTab={(tab) => setCurrentTab(tab as any)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenRegisterModal={() => {
          setEditingIdea(null);
          setIsRegisterModalOpen(true);
        }}
        onOpenSettingsModal={handleOpenSettings}
        syncStatus={syncStatus}
        onSyncGas={syncWithGas}
      />

      {/* Main Tab Content */}
      <main className="flex-1 flex flex-col">
        {currentTab === 'home' && (
          <HomeView
            ideas={ideas}
            recentViewedIds={recentViewedIds}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSwitchTab={(tab) => setCurrentTab(tab as any)}
            onOpenPreviewModal={handleOpenPreviewModal}
            onOpenRegisterModal={() => {
              setEditingIdea(null);
              setIsRegisterModalOpen(true);
            }}
            onTriggerCreativeModal={() => setIsCreativeModalOpen(true)}
          />
        )}

        {currentTab === 'preview' && (
          <FeedView
            ideas={ideas}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedTags={selectedTags}
            onSelectTags={setSelectedTags}
            selectedSubTags={selectedSubTags}
            onSelectSubTags={setSelectedSubTags}
            onOpenPreviewModal={handleOpenPreviewModal}
            onStartEditIdea={(id) => {
              const target = ideas.find((i) => String(i.id) === String(id));
              if (target) {
                setEditingIdea(target);
                setIsRegisterModalOpen(true);
              }
            }}
            onDeleteSingleIdea={handleDeleteSingleIdea}
            onBatchDeleteIdeas={handleBatchDeleteIdeas}
            todayRecIdea={todayRecIdea}
            onRefreshTodayRec={refreshTodayRecommendation}
            pageSize={pageSize}
            onExportData={handleExportData}
            onOpenRegisterModal={() => {
              setEditingIdea(null);
              setIsRegisterModalOpen(true);
            }}
          />
        )}

        {currentTab === 'graph' && (
          <GraphView
            ideas={ideas}
            onOpenPreviewModal={handleOpenPreviewModal}
            onSelectTag={(tag) => setSelectedTags([tag])}
            onSwitchTab={(tab) => setCurrentTab(tab as any)}
          />
        )}

        {currentTab === 'chat' && (
          <AiChatView
            ideas={ideas}
            onOpenPreviewModal={handleOpenPreviewModal}
          />
        )}
      </main>

      {/* Modals */}
      <EBookReaderModal
        idea={previewIdea}
        isOpen={Boolean(previewIdeaId)}
        searchQuery={searchQuery}
        onClose={() => setPreviewIdeaId(null)}
        onStartEdit={(id) => {
          const target = ideas.find((i) => String(i.id) === String(id));
          if (target) {
            setEditingIdea(target);
            setIsRegisterModalOpen(true);
          }
        }}
        onDelete={handleDeleteSingleIdea}
        onSelectTag={(tag) => {
          setSelectedTags([tag]);
          setCurrentTab('preview');
        }}
      />

      <RegisterEditModal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setEditingIdea(null);
        }}
        onSave={handleSaveIdea}
        editingIdea={editingIdea}
        existingIdeas={ideas}
      />

      <CreativeSynthesisModal
        isOpen={isCreativeModalOpen}
        onClose={() => setIsCreativeModalOpen(false)}
        ideas={ideas}
        onSaveNewIdea={handleSaveIdea}
      />

      <OwnerAuthModal
        isOpen={isOwnerAuthModalOpen}
        onClose={() => setIsOwnerAuthModalOpen(false)}
        remoteOwnerPin={remoteOwnerPin}
        onSuccess={() => {
          setIsOwnerAuthModalOpen(false);
          setIsOwnerAuthenticated(true);
          setIsSettingsModalOpen(true);
        }}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        gasConfig={gasConfig}
        onUpdateGasConfig={setGasConfig}
        syncStatus={syncStatus}
        onTestSync={syncWithGas}
        pageSize={pageSize}
        onChangePageSize={setPageSize}
        onExportData={handleExportData}
        onImportData={handleImportData}
      />

    </div>
  );
}
