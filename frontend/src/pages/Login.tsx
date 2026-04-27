import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import RingoLogo from '../components/common/RingoLogo';

export default function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/api/auth/login', { email, password });
      await queryClient.refetchQueries({ queryKey: ['auth', 'me'] });
      navigate('/');
    } catch {
      setError('メールアドレスまたはパスワードが正しくありません。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — brand illustration ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-700 flex-col relative overflow-hidden select-none">

        {/* Subtle background rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[560px] h-[560px] rounded-full border border-white/8 absolute" />
          <div className="w-[400px] h-[400px] rounded-full border border-white/8 absolute" />
          <div className="w-[240px] h-[240px] rounded-full bg-brand-600/40 absolute" />
        </div>

        {/* Corner accents */}
        <div className="absolute top-0 right-0 w-52 h-52 bg-brand-600/50 rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-brand-800/60 rounded-tr-full" />

        {/* Centre content */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-12 text-center">

          {/* Logo illustration — large, white */}
          <RingoLogo size={120} color="white" className="mb-8 drop-shadow-lg opacity-95" />

          {/* Wordmark */}
          <h1 className="text-5xl font-bold tracking-[0.2em] text-white mb-2">
            RINGO
          </h1>

          {/* Japanese subtitle */}
          <p className="text-sm text-white/65 tracking-widest mb-1 font-medium">
            苹果 · 稟議
          </p>
          <p className="text-xs text-white/40 tracking-widest uppercase mb-10">
            Approval &amp; Workflow Platform
          </p>

          <div className="w-12 h-px bg-white/20 mb-10" />

          <p className="text-sm text-white/55 leading-relaxed max-w-[260px]">
            稟議・申請から精算まで、<br />
            ひとつのプラットフォームで完結。
          </p>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-center text-xs text-white/25 pb-6">
          © JMC Ltd. All rights reserved.
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 bg-warm-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo — shown only below lg breakpoint */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <RingoLogo size={56} className="mb-3" />
            <h1 className="text-2xl font-bold text-brand-700 tracking-[0.2em]">RINGO</h1>
            <p className="text-xs text-gray-400 tracking-wide mt-0.5">苹果 · 稟議</p>
          </div>

          <h2 className="text-2xl font-bold text-brand-900 mb-1">ログイン</h2>
          <p className="text-sm text-gray-500 mb-8">アカウントを選択してください</p>

          {/* Google sign-in */}
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-3 w-full bg-white border border-warm-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-warm-100 hover:border-warm-400 transition-colors shadow-sm mb-5"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google アカウントでログイン
          </a>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-warm-300" />
            </div>
            <div className="relative flex justify-center">
              <span className="text-xs text-gray-400 bg-warm-50 px-3">または</span>
            </div>
          </div>

          {/* Email / password */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-widest uppercase">
                メールアドレス
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white border border-warm-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-widest uppercase">
                パスワード
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-warm-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-xs text-brand-600 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors shadow-sm"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
