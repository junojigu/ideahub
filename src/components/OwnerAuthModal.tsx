import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, X } from 'lucide-react';

interface OwnerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  remoteOwnerPin?: string;
}

const OWNER_PIN_KEY = 'ideahub_owner_pin_v1';
const DEFAULT_PIN = '1234';

export const OwnerAuthModal: React.FC<OwnerAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  remoteOwnerPin,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');

  if (!isOpen) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const localPin = localStorage.getItem(OWNER_PIN_KEY) || DEFAULT_PIN;
    const inputClean = pinInput.trim();

    const isValid =
      (remoteOwnerPin && inputClean === remoteOwnerPin.trim()) ||
      inputClean === localPin ||
      inputClean === DEFAULT_PIN;

    if (isValid) {
      setErrorMsg('');
      setPinInput('');
      onSuccess();
    } else {
      setErrorMsg('비밀번호가 일치하지 않습니다. (구글 시트 setting B1셀 비밀번호 또는 기본 1234)');
    }
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length < 4) {
      alert('비밀번호는 최소 4자리 이상으로 설정해주세요.');
      return;
    }
    localStorage.setItem(OWNER_PIN_KEY, newPin.trim());
    alert('소유자 비밀번호가 성공적으로 변경되었습니다!');
    setIsChangingPin(false);
    setNewPin('');
    setErrorMsg('');
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">소유자 보안 인증</h3>
              <p className="text-[11px] text-slate-400 font-medium">Google 시트 소유자 전용 설정</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5">
          {!isChangingPin ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>시스템 관리자 및 시트 소유자 권한 확인이 필요합니다.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  소유자 비밀번호 (기본: 1234)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="비밀번호 입력..."
                    autoFocus
                    className="w-full pl-3.5 pr-10 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                </div>
                {errorMsg && (
                  <p className="text-[11px] font-bold text-red-600 mt-1.5">{errorMsg}</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setIsChangingPin(true)}
                  className="text-xs text-slate-500 hover:text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  비밀번호 변경
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    확인
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePin} className="space-y-4">
              <div className="text-xs font-bold text-slate-800">새 소유자 비밀번호 설정</div>
              <div>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="새 비밀번호 (4자리 이상)..."
                  className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsChangingPin(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  돌아가기
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-all cursor-pointer"
                >
                  비밀번호 저장
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
