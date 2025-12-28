
import React, { useState, useRef } from 'react';
import { ContentType, Post } from '../types';
import { X, PlayCircle, ImageIcon, Loader2, Sparkles, MessageSquare } from 'lucide-react';

interface PostEditorProps {
  onPublish: (postData: Partial<Post>) => void;
  userAvatar: string;
}

const PostEditor: React.FC<PostEditorProps> = ({ onPublish }) => {
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<ContentType>('text');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handlePublish = async () => {
    if (!content.trim() && !mediaUrl) return;
    setIsPublishing(true);
    try {
      await onPublish({
        content,
        type: contentType,
        mediaUrl: mediaUrl || undefined,
        visibility: 'members',
      });
      setContent('');
      setContentType('text');
      setMediaUrl(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: ContentType) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaUrl(reader.result as string);
        setContentType(type);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeMedia = () => {
    setMediaUrl(null);
    setContentType('text');
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  return (
    <div className="bg-[#141414] border border-white/5 rounded-[32px] p-6 shadow-xl mb-8 transition-all group focus-within:border-red-600/20">
      <div className="flex flex-col w-full">
        <div className="flex gap-4 mb-4 items-start">
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-red-500 shrink-0">
            <MessageSquare size={20} />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isPublishing}
            placeholder="Compartilhe um insight estratégico com a comunidade..."
            className="w-full bg-transparent border-none focus:ring-0 text-gray-200 placeholder:text-gray-700 resize-none min-h-[100px] text-sm md:text-base leading-relaxed pt-2"
          />
        </div>

        {mediaUrl && (
          <div className="relative mt-2 mb-6 rounded-3xl overflow-hidden border border-white/10 bg-black/40 group max-h-[400px] flex items-center justify-center">
            {contentType === 'image' ? (
              <img src={mediaUrl} className="max-w-full h-auto object-contain" alt="Preview" />
            ) : (
              <video src={mediaUrl} className="max-w-full h-full object-contain" controls />
            )}
            {!isPublishing && (
              <button 
                onClick={removeMedia}
                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-red-600 text-white rounded-full transition-all"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
          <div className="flex gap-1 md:gap-3">
            <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'image')} />
            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={(e) => handleFileChange(e, 'video')} />
            
            <button 
              disabled={isPublishing}
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 text-gray-500 hover:text-white transition-all disabled:opacity-30"
            >
              <ImageIcon size={18} /> <span className="hidden sm:inline">Imagem</span>
            </button>
            <button 
              disabled={isPublishing}
              onClick={() => videoInputRef.current?.click()}
              className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 text-gray-500 hover:text-white transition-all disabled:opacity-30"
            >
              <PlayCircle size={18} /> <span className="hidden sm:inline">Vídeo</span>
            </button>
          </div>
          
          <button
            onClick={handlePublish}
            disabled={(!content.trim() && !mediaUrl) || isPublishing}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 md:px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-red-600/20 active:scale-95"
          >
            {isPublishing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                A Publicar...
              </>
            ) : (
              <>
                Publicar
                <Sparkles size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostEditor;
