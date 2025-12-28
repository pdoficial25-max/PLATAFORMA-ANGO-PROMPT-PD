
import React, { useState, useRef, useEffect } from 'react';
import { Section, Post, UserRole, User, ReactionType, Comment, AppNotification } from './types';
import { supabase } from './lib/supabase';
import Sidebar from './components/Sidebar';
import PostEditor from './components/PostEditor';
import PostCard from './components/PostCard';
import LoginPage from './components/LoginPage';
import AIChatbot from './components/AIChatbot';
import ResourcesPage from './components/ResourcesPage';
import PromptGenerator from './components/PromptGenerator';
import MessagesSection from './components/MessagesSection';
import DoubtsPage from './components/DoubtsPage';
import AnnouncementsPage from './components/AnnouncementsPage';
import CoursesPage from './components/CoursesPage';
import EbooksPage from './components/EbooksPage';
import MentorshipsPage from './components/MentorshipsPage';
import ResultsPage from './components/ResultsPage';
import MembersPage from './components/MembersPage';
import { 
  Bell, 
  ChevronDown, 
  Camera, 
  ArrowLeft,
  Loader2,
  UserCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('Feed');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [targetChatUserId, setTargetChatUserId] = useState<string | null>(null);

  const isMounted = useRef(true);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const parseError = (err: any): string => {
    if (!err) return 'Erro desconhecido';
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    if (err.code === '42501') return 'Erro de RLS: Políticas de banco de dados não configuradas.';
    return JSON.stringify(err);
  };

  useEffect(() => {
    isMounted.current = true;
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (isMounted.current) {
          if (session) {
            await fetchProfile(session.user.id, session.user.email || '');
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        if (isMounted.current) setIsAuthenticated(false);
      } finally {
        if (isMounted.current) setIsAuthenticating(false);
      }
    };
    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted.current) return;
      if (session) {
        await fetchProfile(session.user.id, session.user.email || '');
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
      setIsAuthenticating(false);
    });

    return () => {
      isMounted.current = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (isMounted.current) {
        if (data) {
          setCurrentUser({
            id: data.id,
            name: data.name || 'Membro Elite',
            email: data.email || email,
            role: (data.role as UserRole) || UserRole.MEMBER,
            avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
            followingIds: data.following_ids || [],
            bio: data.bio || '',
            city: data.city || '',
            area: data.area || '',
            isMentor: data.is_mentor || false
          });
        } else {
          // Se autenticado mas sem perfil, tenta criar
          const defaultUser: User = {
            id: userId,
            name: 'Novo Membro',
            email: email,
            role: UserRole.MEMBER,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
            followingIds: [],
            bio: '',
            city: '',
            area: ''
          };
          setCurrentUser(defaultUser);
          
          // Tenta persistir no banco silenciosamente
          await supabase.from('profiles').upsert({
            id: userId,
            email: email,
            name: 'Novo Membro',
            role: 'MEMBER'
          });
        }
      }
    } catch (err) {
      console.error("Erro ao buscar perfil:", parseError(err));
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      alert("Escolha apenas imagens.");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar: publicUrl })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      setCurrentUser(prev => prev ? { ...prev, avatar: publicUrl } : null);
      alert("Avatar atualizado!");
    } catch (err) {
      alert("Erro: " + parseError(err));
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchPosts();
    }
  }, [isAuthenticated, feedFilter, currentUser]);

  const fetchPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_user_id_fkey(name, avatar),
          comments(*, author:profiles(name, avatar))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const formattedPosts: Post[] = data.map(p => ({
          id: p.id,
          userId: p.user_id,
          userName: p.author?.name || 'Membro Elite',
          userAvatar: p.author?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.user_id}`,
          type: p.type,
          content: p.content,
          mediaUrl: p.media_url,
          timestamp: new Date(p.created_at).getTime(),
          visibility: p.visibility,
          likes: p.likes || 0,
          reactions: p.reactions || { like: 0, love: 0, fire: 0 },
          views: p.views || 0,
          commentsCount: p.comments?.length || 0,
          comments: (p.comments || []).map((c: any) => ({
            id: c.id,
            userId: c.user_id,
            userName: c.author?.name || 'Membro',
            userAvatar: c.author?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=ango',
            content: c.content,
            timestamp: new Date(c.created_at).getTime()
          })).sort((a: any, b: any) => a.timestamp - b.timestamp)
        }));
        setPosts(formattedPosts);
      }
    } catch (err) {
      console.error("Erro nos posts:", parseError(err));
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const handlePublishPost = async (postData: Partial<Post>) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from('posts').insert([{
        user_id: currentUser.id,
        content: postData.content,
        type: postData.type,
        media_url: postData.mediaUrl,
        visibility: postData.visibility || 'members'
      }]);
      if (error) throw error;
      await fetchPosts();
    } catch (err: any) {
      alert(`Falha na Publicação: ${parseError(err)}`);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const { data: postData } = await supabase.from('posts').select('likes').eq('id', postId).single();
      const currentLikes = postData?.likes || 0;
      await supabase.from('posts').update({ likes: currentLikes + 1 }).eq('id', postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
    } catch (err) {
      console.error(parseError(err));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveProfile = async (formData: any) => {
    if (!currentUser) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: currentUser.id,
        name: formData.name,
        bio: formData.bio,
        city: formData.city,
        area: formData.area,
        avatar: currentUser.avatar,
        email: currentUser.email
      });
      if (error) throw error;
      alert("Perfil atualizado!");
      setActiveSection('Feed');
    } catch (err) {
      alert("Erro: " + parseError(err));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const isFullscreen = ['PromptGenerator', 'Dúvidas', 'Cursos', 'E-books', 'Mentorias', 'Membros', 'Resultados', 'Configuracoes'].includes(activeSection);

  const renderContent = () => {
    if (!currentUser) return null;
    switch(activeSection) {
      case 'Feed':
        return (
          <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full px-4 pt-2">
            <header className="mb-8 text-center">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-black mb-3 tracking-tight text-red-600 uppercase leading-tight">
                BEM-VINDO À PLATAFORMA <br /> ANGO – PROMPT PD
              </h2>
              <div className="flex justify-center gap-2 bg-white/5 p-1 rounded-2xl w-fit mx-auto border border-white/10">
                <button onClick={() => setFeedFilter('all')} className={`px-6 md:px-8 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all uppercase tracking-widest ${feedFilter === 'all' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-white'}`}>Todos</button>
                <button onClick={() => setFeedFilter('following')} className={`px-6 md:px-8 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all uppercase tracking-widest ${feedFilter === 'following' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-white'}`}>A Seguir</button>
              </div>
            </header>
            <PostEditor onPublish={handlePublishPost} userAvatar={currentUser.avatar} />
            <div className="space-y-4 pb-20">
              {isLoadingPosts ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-red-600" size={32} /></div>
              ) : posts.length > 0 ? (
                posts.map(post => (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    currentUser={currentUser}
                    isFollowing={currentUser.followingIds.includes(post.userId)}
                    onLike={() => handleLikePost(post.id)}
                    onMessageUser={() => {
                      setTargetChatUserId(post.userId);
                      setActiveSection('Mensagens');
                    }}
                  />
                ))
              ) : (
                <div className="text-center p-20 bg-white/5 rounded-[40px] border border-dashed border-white/10">
                  <p className="text-gray-500 uppercase font-black text-xs tracking-widest">Nenhuma publicação na comunidade ainda.</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'Mensagens':
        return <MessagesSection currentUser={currentUser} initialTargetUserId={targetChatUserId} />;
      case 'PromptGenerator':
        return <PromptGenerator />;
      case 'Recursos':
        return <ResourcesPage onNavigate={setActiveSection} />;
      case 'Dúvidas':
        return <DoubtsPage onNavigate={setActiveSection} />;
      case 'Cursos':
        return <CoursesPage />;
      case 'Meu Perfil':
        return (
          <div className="max-w-4xl mx-auto w-full px-4 py-6 md:py-10 text-center">
            <h2 className="text-2xl md:text-4xl font-black text-white uppercase mb-8 tracking-tighter">Configurações de Perfil</h2>
            <div className="bg-[#141414] rounded-[32px] md:rounded-[48px] p-6 md:p-12 border border-white/5 text-left shadow-2xl">
               <div className="flex flex-col items-center gap-6 mb-12">
                  <div className="relative group w-24 h-24 md:w-32 md:h-32">
                    <img src={currentUser.avatar} className="w-full h-full rounded-full object-cover border-4 border-red-600/20" alt="Avatar" />
                    <button 
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                    >
                      {isUploadingAvatar ? <Loader2 className="animate-spin text-white" /> : <Camera className="text-white" size={24} />}
                    </button>
                    <input 
                      type="file" 
                      ref={avatarInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleAvatarUpload} 
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="text-white font-black uppercase text-lg md:text-xl">{currentUser.name}</h3>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Nível: {currentUser.role}</p>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-2">Nome de Exibição</label>
                    <input type="text" value={currentUser.name} onChange={(e) => setCurrentUser({...currentUser, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-red-600/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-2">Área de Atuação</label>
                    <input type="text" value={currentUser.area} onChange={(e) => setCurrentUser({...currentUser, area: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-red-600/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-2">Cidade/Região</label>
                    <input type="text" value={currentUser.city} onChange={(e) => setCurrentUser({...currentUser, city: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-red-600/50" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-2">Bio Profissional</label>
                    <textarea value={currentUser.bio} onChange={(e) => setCurrentUser({...currentUser, bio: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white min-h-[100px] outline-none focus:border-red-600/50 resize-none" />
                  </div>
                  <button onClick={() => handleSaveProfile(currentUser)} className="md:col-span-2 w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl text-white font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-xl shadow-red-600/10 mt-4">
                    {isSavingProfile ? <Loader2 className="animate-spin mx-auto" /> : 'Salvar Alterações'}
                  </button>
               </div>
            </div>
          </div>
        );
      default:
        return <div className="text-center p-20 text-gray-500 uppercase font-black tracking-widest">Em Desenvolvimento</div>;
    }
  };

  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-red-600 mb-4 mx-auto" size={48} />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest animate-pulse">Autenticando Rede Elite...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 overflow-x-hidden flex">
      {!isFullscreen && (
        <Sidebar 
          activeSection={activeSection} 
          onSectionChange={setActiveSection} 
          isMobileOpen={isMobileSidebarOpen}
          isSidebarVisible={isSidebarVisible}
          toggleMobile={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          user={currentUser!}
          onLogout={handleLogout}
        />
      )}
      <main className={`${!isFullscreen && isSidebarVisible ? 'md:ml-64' : 'md:ml-0'} min-h-screen flex flex-col flex-1 transition-all duration-500`}>
        <header className="sticky top-0 z-40 h-16 md:h-20 flex items-center justify-between px-6 md:px-8 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-4">
            {!isFullscreen && (
              <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="hidden md:flex p-2 bg-white/5 rounded-lg text-gray-400">
                {isSidebarVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              </button>
            )}
            {isFullscreen && (
              <button onClick={() => setActiveSection('Feed')} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-lg text-white transition-all hover:bg-red-700 active:scale-95">
                <ArrowLeft size={16} /> <span className="text-[9px] font-black uppercase">Sair</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
             <button className="p-2.5 bg-white/5 rounded-xl text-gray-400 relative hover:text-white transition-colors">
               <Bell size={18} />
               <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-600 rounded-full"></span>
             </button>
             <div className="relative">
               <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="flex items-center gap-2 p-1 pl-1 pr-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                 <img src={currentUser?.avatar} className="w-8 h-8 rounded-full object-cover border border-red-600" alt="User" />
                 <ChevronDown size={10} className={`text-gray-500 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
               </button>
               {isProfileMenuOpen && (
                 <div className="absolute top-full right-0 mt-2 w-56 bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                   <button onClick={() => {setActiveSection('Meu Perfil'); setIsProfileMenuOpen(false)}} className="w-full flex items-center gap-3 px-4 py-3 text-[9px] font-black text-gray-400 hover:text-white hover:bg-white/5 uppercase transition-all rounded-lg">
                     <UserCircle size={16} className="text-red-600" /> Meu Perfil
                   </button>
                   <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-[9px] font-black text-red-500 hover:bg-red-500/10 uppercase transition-all rounded-lg">
                     <LogOut size={16} /> Encerrar Sessão
                   </button>
                 </div>
               )}
             </div>
          </div>
        </header>
        <section className="flex-1 pb-10">
          {renderContent()}
        </section>
      </main>
      <AIChatbot />
    </div>
  );
};

export default App;
