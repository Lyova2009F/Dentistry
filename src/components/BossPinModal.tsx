import { useState, type FormEvent } from 'react';
import { X, Lock } from 'lucide-react';
import { verifyBossCode } from '../utils/bookingLogic';

interface BossPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BossPinModal({ isOpen, onClose, onSuccess }: BossPinModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (verifyBossCode(code)) {
      setError('');
      setCode('');
      onSuccess();
    } else {
      setError('Неверный код доступа. Попробуйте ещё раз.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boss-pin-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 sm:p-7 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Lock className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="boss-pin-title" className="text-base font-bold text-slate-900">
                Доступ руководителя
              </h2>
              <p className="text-xs text-slate-500">Введите 4-значный код клиники</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCode('');
              setError('');
              onClose();
            }}
            aria-label="Закрыть окно входа"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="boss-pin-input" className="sr-only">
            Код доступа руководителя
          </label>
          <input
            id="boss-pin-input"
            type="password"
            inputMode="numeric"
            maxLength={8}
            autoFocus
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError('');
            }}
            placeholder="••••"
            className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono-tabular text-slate-900 bg-[#F8FAFC] border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/15 mb-3"
          />

          {error && (
            <p className="text-xs text-rose-600 mb-3 text-center" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setCode('');
                setError('');
                onClose();
              }}
              className="flex-1 py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Войти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
