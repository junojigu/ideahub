import React, { useState } from 'react';
import { Sparkles, X, Loader2, Plus, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Idea, CreativeSynthesisResult } from '../types';

interface CreativeSynthesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  ideas: Idea[];
  onSaveNewIdea: (ideaData: Partial<Idea>) => void;
}

export const CreativeSynthesisModal: React.FC<CreativeSynthesisModalProps> = ({
  isOpen,
  onClose,
  ideas,
  onSaveNewIdea,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CreativeSynthesisResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSynthesize = async () => {
    if (ideas.length < 2) {
      alert('아이디어 교차 연상을 위해 최소 2개 이상의 아이디어가 지식창고에 등록되어 있어야 합니다.');
      return;
    }

    setIsLoading(true);
    setIsSaved(false);

    // Pick 2 or 3 random ideas
    const shuffled = [...ideas].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(3, shuffled.length));

    try {
      const response = await fetch('/api/gemini/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideas: selected }),
      });

      if (!response.ok) throw new Error('AI 아이디어 연상 실패');

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      alert(`AI 발상 연상 오류: ${error?.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSynthesisToVault = () => {
    if (!result) return;

    onSaveNewIdea({
      title: `[AI 발상] ${result.synthesisTitle}`,
      content: `${result.conceptDescription}\n\n**실행 단계:**\n${result.actionableNextSteps.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}`,
      tags: ['AI발상', '신규기획', '융합'],
      importance: 5,
    });

    setIsSaved(true);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-amber-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-5 sm:p-6 relative overflow-hidden shrink-0 flex items-center justify-between">
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 text-white flex items-center justify-center font-bold text-xl shadow-inner shrink-0">
              <Sparkles className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <h3 className="font-black text-lg sm:text-xl text-white font-sans flex items-center gap-2">
                <span>I'm Feeling Creative (AI 라테럴 싱킹)</span>
              </h3>
              <p className="text-xs text-amber-100 font-medium">
                지식 창고 내 이질적인 아이디어들을 Gemini AI가 교차 연상하여 창의적 신규 프로젝트를 제안합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 flex flex-col gap-5 overflow-y-auto font-sans">
          
          {!result && !isLoading && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-amber-50 rounded-full border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">새로운 통찰과 연상을 얻어보세요</h4>
                <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                  버튼을 누르면 현재 창고에 보관 중인 {ideas.length}개의 지식 중 2~3개를 무작위 추출하여 독창적인 교차 결합안을 도출합니다.
                </p>
              </div>
              <button
                onClick={handleSynthesize}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-sm rounded-2xl shadow-md transition-all cursor-pointer inline-flex items-center gap-2 active:scale-98"
              >
                <Sparkles className="w-4 h-4" />
                <span>✨ AI 아이디어 교차 생성하기</span>
              </button>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
              <p className="text-sm font-bold text-slate-800">
                보관된 노드를 교차 분석하고 아이디어를 융합하는 중입니다...
              </p>
            </div>
          )}

          {result && !isLoading && (
            <div className="space-y-5">
              
              {/* Synthesized Title */}
              <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border border-amber-200/90 rounded-2xl p-5 space-y-2">
                <span className="text-[11px] font-extrabold text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                  도출된 융합 프로젝트
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 font-sans">
                  {result.synthesisTitle}
                </h3>
              </div>

              {/* Combined Source Ideas */}
              <div className="space-y-1.5">
                <span className="text-xs font-extrabold text-slate-500">결합된 원본 지식 노트:</span>
                <div className="flex flex-wrap gap-2">
                  {result.combinedIdeas?.map((item) => (
                    <span
                      key={item.id}
                      className="text-xs bg-slate-100 border border-slate-200 px-3 py-1 rounded-xl text-slate-800 font-bold"
                    >
                      📄 {item.title}
                    </span>
                  ))}
                </div>
              </div>

              {/* Concept Description */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1.5">
                <h4 className="text-xs font-extrabold text-slate-800">개념 및 시너지 설명</h4>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal whitespace-pre-wrap">
                  {result.conceptDescription}
                </p>
              </div>

              {/* Actionable Steps */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                <h4 className="text-xs font-extrabold text-slate-800">추천 실행 단계</h4>
                <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                  {result.actionableNextSteps?.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-600 font-bold shrink-0">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleSynthesize}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>다시 뽑기</span>
                </button>

                <button
                  onClick={handleSaveSynthesisToVault}
                  disabled={isSaved}
                  className={`px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSaved
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                  }`}
                >
                  {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{isSaved ? '지식창고에 저장됨' : '✨ 지식창고에 이 아이디어 저장'}</span>
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
