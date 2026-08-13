import React, { useState } from 'react';
import { MessageSquareCode, Send, Bot, User, Sparkles, BookOpen, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Idea, ChatMessage } from '../types';

interface AiChatViewProps {
  ideas: Idea[];
  onOpenPreviewModal: (ideaId: string) => void;
}

export const AiChatView: React.FC<AiChatViewProps> = ({ ideas, onOpenPreviewModal }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      sender: 'ai',
      text: `안녕하세요! **IdeaHub AI 지식 비서**입니다.\n\n저장하신 총 **${ideas.length}개**의 지식 노트에서 궁금한 점을 질문하시면, 저장된 내용을 바탕으로 답변을 구성하고 관련 노트를 소환해 드립니다.`,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const quickPrompts = [
    '내 모든 AI 관련 아이디어 요약해줘',
    '가장 중요도가 높은 아이디어 3가지 추천해줘',
    '스마트 오피스 및 IoT 관련 아이디어 찾아줘',
    'GAS(Google Apps Script) 관련 지식 노트 정리',
  ];

  const handleSendMessage = async (queryText?: string) => {
    const query = (queryText || inputQuery).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: query,
          ideas,
        }),
      });

      if (!response.ok) {
        throw new Error('AI 지식 비서 응답에 실패했습니다.');
      }

      const data = await response.json();

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: data.answer || '답변을 생성하지 못했습니다.',
        referencedIdeaIds: data.referencedIdeaIds || [],
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: `⚠️ 오류가 발생했습니다: ${error?.message || 'Gemini API 호출 오류'}`,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col h-[calc(100vh-100px)]">
      
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-t-3xl p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-purple-200">
            <MessageSquareCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-base sm:text-lg text-white font-sans flex items-center gap-2">
              <span>AI 지식 Q&A 비서</span>
              <span className="text-[10px] font-bold bg-purple-500/30 border border-purple-400/40 px-2 py-0.5 rounded-full text-purple-200">
                Gemini Powered
              </span>
            </h2>
            <p className="text-xs text-purple-200/80 font-medium">
              저장된 {ideas.length}개의 지식 노트를 학습한 AI가 질문에 답합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Messages Chat Area */}
      <div className="flex-1 bg-slate-50 border-x border-slate-200 p-4 sm:p-6 overflow-y-auto space-y-4 font-sans">
        {messages.map((msg) => {
          const isAi = msg.sender === 'ai';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isAi ? 'items-start' : 'items-end justify-end'}`}
            >
              {isAi && (
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-[75%] space-y-2 ${isAi ? '' : 'flex flex-col items-end'}`}>
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    isAi
                      ? 'bg-white text-slate-800 border border-slate-200'
                      : 'bg-blue-600 text-white font-medium'
                  }`}
                >
                  {isAi ? (
                    <div className="markdown-body space-y-2">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}
                </div>

                {/* Referenced Notes Badges */}
                {isAi && msg.referencedIdeaIds && msg.referencedIdeaIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-purple-600" />
                      참고된 지식 노트:
                    </span>
                    {msg.referencedIdeaIds.map((id) => {
                      const refIdea = ideas.find((i) => String(i.id) === String(id));
                      if (!refIdea) return null;
                      return (
                        <button
                          key={id}
                          onClick={() => onOpenPreviewModal(id)}
                          className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 px-2.5 py-0.5 rounded-lg font-bold transition-all cursor-pointer truncate max-w-[200px]"
                        >
                          📄 {refIdea.title}
                        </button>
                      );
                    })}
                  </div>
                )}

                <span className="text-[10px] text-slate-400 font-medium px-1">
                  {msg.timestamp}
                </span>
              </div>

              {!isAi && (
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3 text-xs text-purple-700 bg-purple-50 border border-purple-200 p-3.5 rounded-2xl w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span className="font-bold">저장된 지식 창고 데이터를 검색하고 답변을 생성 중입니다...</span>
          </div>
        )}
      </div>

      {/* Footer Area: Quick Prompts & Input Bar */}
      <div className="bg-white border border-slate-200 rounded-b-3xl p-3 sm:p-4 space-y-3 shrink-0">
        
        {/* Quick Prompts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            추천 질문:
          </span>
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              disabled={isLoading}
              className="text-xs bg-slate-100 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 border border-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Text Input Box */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder="지식창고에 궁금한 점을 질문해보세요..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputQuery.trim()}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-2xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">전송</span>
          </button>
        </div>

      </div>

    </div>
  );
};
