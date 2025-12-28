
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, Sparkles, AlertCircle, Loader2, ArrowRight, Mail, Lock, User } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const parseError = (err: any): string => {
    if (!err) return 'Erro desconhecido';
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    if (err.error_description) return err.error_description;
    if (err.code === '42501') return 'Erro de Permissão (RLS): Execute o script SQL no painel do Supabase para liberar a tabela profiles.';
    return JSON.stringify(err);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    setIsLoading(true);
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Insira um e-mail válido.');
      setIsLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() }
          }
        });

        if (authError) throw authError;
        
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert([{
            id: data.user.id,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role: 'MEMBER'
          }], { onConflict: 'id' });
          
          if (profileError) throw profileError;
        }

        alert('Acesso Elite criado! Agora podes entrar.');
        setIsSignUp(false);
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password, 
        });

        if (authError) throw authError;
      }
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-start justify-center p-4 pt-6 md:pt-10 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-red-900/10 blur-[100px] rounded-full pointer-events-none"></div>
      
      <div className="max-w-md w-full z-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600/10 border border-red-600/20 mb-4 shadow-2xl shadow-red-600/10">
            <Sparkles className="text-red-600" size={32} />
          </div>
          <h1 className="text-3xl font-black text-red-600 mb-1 tracking-tighter uppercase leading-none">ANGO – PROMPT PD</h1>
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
            {isSignUp ? 'Elite Training Center' : 'Painel de Membros'}
          </p>
        </div>

        <div className="bg-[#0f0f0f]/90 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 md:p-10 shadow-2xl">
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="O teu nome"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm text-white focus:border-red-600/50 outline-none transition-all placeholder:text-gray-800"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">E-mail de Compra</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm text-white focus:border-red-600/50 outline-none transition-all placeholder:text-gray-800"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Código de Acesso</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm text-white focus:border-red-600/50 outline-none transition-all placeholder:text-gray-800"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black p-4 rounded-2xl flex items-center gap-3 animate-pulse uppercase leading-tight">
                <AlertCircle size={16} className="shrink-0" />
                <span className="flex-1 break-words">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-3 group active:scale-[0.98] disabled:opacity-50 text-[10px] uppercase tracking-[0.2em]"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isSignUp ? 'Criar Acesso Elite' : 'Entrar na Plataforma'}
                  <ShieldCheck size={18} className="group-hover:rotate-12 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button 
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2 mx-auto active:scale-95"
            >
              {isSignUp ? 'Já tem conta? Login' : 'Não tem conta? Criar acesso'}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
