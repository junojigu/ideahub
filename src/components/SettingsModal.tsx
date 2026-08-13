import React, { useState } from 'react';
import { Settings, X, RefreshCw, Code, Download, Upload, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { GasConfig, SyncStatus } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasConfig: GasConfig;
  onUpdateGasConfig: (config: GasConfig) => void;
  syncStatus: SyncStatus;
  onTestSync: () => void;
  pageSize: number;
  onChangePageSize: (size: number) => void;
  onExportData: (format: 'json' | 'csv') => void;
  onImportData: (jsonContent: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  gasConfig,
  onUpdateGasConfig,
  syncStatus,
  onTestSync,
  pageSize,
  onChangePageSize,
  onExportData,
  onImportData,
}) => {
  const [activeTab, setActiveTab] = useState<'gas' | 'code' | 'data'>('gas');
  const [urlInput, setUrlInput] = useState(gasConfig.gasUrl);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const isSheetUrl = urlInput.includes('docs.google.com/spreadsheets');
  const extractedSheetId = isSheetUrl ? urlInput.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] : null;

  const handleSaveGasUrl = () => {
    if (isSheetUrl) {
      alert('입력하신 주소는 구글 시트 문서 주소입니다.\n\n해당 시트의 [확장 프로그램] > [Apps Script]에서 웹 앱으로 배포한 후 나오는 "https://script.google.com/macros/s/.../exec" 주소를 입력하셔야 데이터가 연동됩니다.\n\n아래의 [Code.gs 소스] 탭을 확인하여 배포해주세요!');
      return;
    }
    onUpdateGasConfig({
      ...gasConfig,
      gasUrl: urlInput.trim(),
    });
    onTestSync();
  };

  const currentSheetId = extractedSheetId || '1pnjEJN6l_a3aDI6Q_GSWzeUnpFAxmcWqQ6c9Nanu7Co';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportData(content);
      }
    };
    reader.readAsText(file);
  };

  const codeGsSnippet = `/**
 * Google Apps Script (GAS) Backend Code for IdeaHub 지식창고
 * Spreadsheet ID: ${currentSheetId}
 */
var SPREADSHEET_ID = '${currentSheetId}';

// setting 시트에서 소유자 비밀번호(B1) 및 Deploy URL(B3) 읽기
function getAppSettings() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('setting') || ss.getSheetByName('Setting') || ss.getSheetByName('Settings');
    if (!sheet) return { ownerPin: '', deployUrl: '' };

    var ownerPin = sheet.getRange('B1').getValue() ? String(sheet.getRange('B1').getValue()).trim() : '';
    var deployUrl = sheet.getRange('B3').getValue() ? String(sheet.getRange('B3').getValue()).trim() : '';
    return { ownerPin: ownerPin, deployUrl: deployUrl };
  } catch(err) {
    return { ownerPin: '', deployUrl: '' };
  }
}

function getIdeasAndAnalysis() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Ideas') || ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    var ideas = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[0] || row[2]) {
        ideas.push({
          id: String(row[0] || ('ID_' + i)),
          date: row[1] ? String(row[1]).split('T')[0] : new Date().toISOString().split('T')[0],
          title: String(row[2] || '제목 없음'),
          content: String(row[3] || ''),
          tags: row[4] ? String(row[4]).split(',').map(function(t) { return t.trim(); }) : ['일반'],
          sourceUrl: row[5] ? String(row[5]) : '',
          importance: row[6] ? Number(row[6]) : 1,
          views: row[7] ? Number(row[7]) : 1
        });
      }
    }
    return {
      status: 'SUCCESS',
      ideas: ideas,
      settings: getAppSettings()
    };
  } catch(err) {
    return { status: 'ERROR', message: err.toString(), ideas: [], settings: getAppSettings() };
  }
}

function doGet(e) {
  try {
    if (e && e.parameter && (e.parameter.action === 'getIdeasAndAnalysis' || e.parameter.api === 'true')) {
      var data = getIdeasAndAnalysis();
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
    }
    var template = HtmlService.createTemplateFromFile('Index');
    return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).setTitle('IdeaHub 지식창고');
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ERROR', message: err.toString() }));
  }
}

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : null;
    var params = contents ? JSON.parse(contents) : (e ? e.parameter : {});
    var action = params.action;
    var result = { status: 'ERROR', message: 'Unknown action' };

    if (action === 'saveIdea') {
      result = saveIdea(params.title, params.content, params.tags, params.sourceUrl, params.importance);
    } else if (action === 'updateIdea') {
      result = updateIdea(params.id, params.title, params.content, params.tags, params.sourceUrl, params.importance);
    } else if (action === 'deleteIdea') {
      result = deleteIdea(params.id);
    } else if (action === 'getIdeasAndAnalysis') {
      result = getIdeasAndAnalysis();
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ERROR', message: err.toString() }));
  }
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeGsSnippet);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white font-sans">지식창고 설정</h3>
              <p className="text-xs text-slate-300 font-medium">
                구글 스프레드시트 연동, 백업 및 페이지 표시 옵션
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-100 border-b border-slate-200 px-4 pt-2 shrink-0 gap-2">
          <button
            onClick={() => setActiveTab('gas')}
            className={`px-4 py-2 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
              activeTab === 'gas'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            구글 시트 연동 (GAS)
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 text-xs font-extrabold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'code'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Code.gs 소스</span>
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
              activeTab === 'data'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            백업 & 가져오기
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto font-sans flex-1 space-y-5">
          
          {activeTab === 'gas' && (
            <div className="space-y-5">
              
              {/* Connection Status Box */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  syncStatus.connected
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {syncStatus.connected ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div className="text-xs">
                    <span className="font-extrabold">
                      {syncStatus.connected ? 'Google Apps Script 연결 성공' : '스프레드시트 미연결 (로컬 모드 동작 중)'}
                    </span>
                    {syncStatus.lastSyncedAt && (
                      <p className="text-[11px] font-medium opacity-80 mt-0.5">
                        최근 동기화: {syncStatus.lastSyncedAt}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={onTestSync}
                  disabled={syncStatus.isSyncing}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:border-blue-500 text-slate-800 font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                  <span>동기화 테스트</span>
                </button>
              </div>

              {/* GAS URL Input */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="text-xs font-extrabold text-slate-800">
                  Google Apps Script Web App URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-xl bg-white text-slate-900 outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSaveGasUrl}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-2xs cursor-pointer shrink-0"
                  >
                    저장 및 연동
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
                  구글 드라이브 스프레드시트에 웹앱으로 배포된 GAS URL을 입력하면 실시간 양방향 데이터베이스로 작동합니다.
                </p>
              </div>

              {/* Display Page Size */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="text-xs font-extrabold text-slate-800">
                  한 페이지당 표시 개수
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => onChangePageSize(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-extrabold bg-white text-slate-800 outline-none"
                >
                  <option value={5}>5개씩 보기</option>
                  <option value={10}>10개씩 보기</option>
                  <option value={20}>20개씩 보기</option>
                  <option value={30}>30개씩 보기</option>
                </select>
              </div>

            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800">Code.gs 배포 코드</span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copySuccess ? '복사 완료!' : '전체 복사'}</span>
                </button>
              </div>

              <div className="text-xs text-slate-600 bg-amber-50 p-3 rounded-xl border border-amber-200 leading-relaxed">
                💡 구글 드라이브 구글 시트의 <strong>[확장 프로그램] &gt; [Apps Script]</strong> 편집기에 붙여넣고 <strong>웹 앱 배포(액세스 권한: 모든 사용자)</strong>로 설정하시면 완벽하게 작동합니다.
              </div>

              <pre className="bg-slate-900 text-slate-200 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-[300px] leading-relaxed custom-scrollbar">
                {codeGsSnippet}
              </pre>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-5">
              
              {/* Export Box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>지식창고 백업 다운로드</span>
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onExportData('json')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    JSON 백업 파일 다운로드
                  </button>
                  <button
                    onClick={() => onExportData('csv')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    CSV 파일 내보내기
                  </button>
                </div>
              </div>

              {/* Import Box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-purple-600" />
                  <span>JSON 파일 백업 복원</span>
                </h4>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                />
              </div>

            </div>
          )}

        </div>

        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
          >
            설정 완료
          </button>
        </div>

      </div>
    </div>
  );
};
