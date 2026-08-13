import React from 'react';
import { Search, Mic, Plus, Settings, Network, MessageSquareCode, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { SyncStatus } from '../types';

interface HeaderProps {
  currentTab: string;
  onSwitchTab: (tab: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenRegisterModal: () => void;
  onOpenSettingsModal: () => void;
  syncStatus: SyncStatus;
  onSyncGas: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSwitchTab,
  searchQuery,
  onSearchChange,
  onOpenRegisterModal,
  onOpenSettingsModal,
  syncStatus,
  onSyncGas
}) => {
  const [isMicActive, setIsMicActive] = React.useState(false);

  const handleMicClick = () => {
    setIsMicActive(true);
    setTimeout(() => {
      setIsMicActive(false);
      onSearchChange('AI 생산성');
      if (currentTab === 'home') {
        onSwitchTab('preview');
      }
    }, 1200);
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-3 py-2.5 sm:px-6 sm:py-3 transition-all shadow-2xs">
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
        
        {/* Top Row: Logo + Mobile Quick Action Icons */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3 shrink-0">
          <div 
            onClick={() => { onSearchChange(''); onSwitchTab('home'); }}
            className="flex items-center gap-2 cursor-pointer select-none group"
            title="홈으로 이동"
          >
            <div className="flex items-center text-xl sm:text-2xl font-black tracking-tight font-sans">
              <span className="text-[#4285F4]">I</span>
              <span className="text-[#EA4335]">d</span>
              <span className="text-[#FBBC05]">e</span>
              <span className="text-[#34A853]">a</span>
              <span className="text-[#4285F4]">H</span>
              <span className="text-[#EA4335]">u</span>
              <span className="text-[#FBBC05]">b</span>
              <span className="ml-2 text-slate-800 font-extrabold text-sm sm:text-base tracking-normal">지식창고</span>
            </div>
          </div>

          {/* Sync status indicator badge */}
          <button
            onClick={onSyncGas}
            disabled={syncStatus.isSyncing}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
              syncStatus.isSyncing
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : syncStatus.connected
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title="클릭하여 Google Apps Script 동기화"
          >
            {syncStatus.isSyncing ? (
              <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
            ) : syncStatus.connected ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3 h-3 text-slate-400" />
            )}
            <span className="hidden sm:inline">
              {syncStatus.isSyncing ? '동기화 중...' : syncStatus.connected ? '시트 연결됨' : '로컬 모드'}
            </span>
          </button>

          {/* Mobile Right Icons */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={() => onSwitchTab('graph')}
              className={`p-2 rounded-full transition-all ${
                currentTab === 'graph' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="지식 맵"
            >
              <Network className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSwitchTab('chat')}
              className={`p-2 rounded-full transition-all ${
                currentTab === 'chat' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="AI 지식 챗"
            >
              <MessageSquareCode className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenSettingsModal}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              title="설정"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Search Input Box */}
        <div className="w-full md:flex-1 md:max-w-md lg:max-w-lg flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-full px-3.5 py-1.5 sm:py-2 shadow-2xs hover:bg-white focus-within:bg-white focus-within:border-[#4285F4] focus-within:ring-2 focus-within:ring-blue-100 transition-all z-10">
          <Search className="w-4 h-4 text-[#4285F4] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && currentTab === 'home') {
                onSwitchTab('preview');
              }
            }}
            placeholder="지식, 아이디어, 태그 검색..."
            className="w-full text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent outline-none font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 rounded-full transition-colors cursor-pointer shrink-0"
            >
              ✕
            </button>
          )}
          <button
            onClick={handleMicClick}
            className={`p-1 rounded-full transition-colors cursor-pointer shrink-0 ${
              isMicActive ? 'text-red-500 animate-pulse bg-red-50' : 'text-slate-400 hover:text-blue-600'
            }`}
            title="음성 검색"
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>

        {/* Desktop Nav Items */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onSwitchTab('preview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              currentTab === 'preview'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            지식 피드
          </button>

          <button
            onClick={() => onSwitchTab('graph')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'graph'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-indigo-600" />
            <span>지식 맵</span>
          </button>

          <button
            onClick={() => onSwitchTab('chat')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'chat'
                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MessageSquareCode className="w-3.5 h-3.5 text-purple-600" />
            <span>AI 챗</span>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1"></div>

          <button
            onClick={onOpenRegisterModal}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow flex items-center gap-1 cursor-pointer active:scale-98"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>등록</span>
          </button>

          <button
            onClick={onOpenSettingsModal}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="설정 및 구글 시트 연동"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
