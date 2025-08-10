import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Plus, Heart, ThumbsUp, MessageCircle, Calendar, User, Edit3, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

const API_BASE = 'http://localhost:3001';

interface Reaction {
  type: 'like' | 'love';
  userId: string;
  userName: string;
}

interface Comment {
  id: string;
  text: string;
  author: string;
  authorId: string;
  date: Date;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  authorSector: string;
  date: Date;
  reactions: Reaction[];
  comments: Comment[];
}

export const Mural: React.FC = () => {
  const { user } = useAuth();
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
  });
  const [commentTexts, setCommentTexts] = useState<{ [key: string]: string }>({});
  
  const [posts, setPosts] = useState<Post[]>([
    {
      id: '1',
      title: 'Nova política de home office',
      content: 'A partir de 1º de fevereiro, todos os colaboradores poderão trabalhar em home office 2 dias por semana. Para mais informações, entre em contato com o RH.',
      author: 'Maria Santos',
      authorId: '2',
      authorSector: 'RH',
      date: new Date('2025-01-14'),
      reactions: [
        { type: 'like', userId: '1', userName: 'João Silva' },
        { type: 'love', userId: '3', userName: 'Carlos Oliveira' },
      ],
      comments: [
        {
          id: '1',
          text: 'Excelente notícia! Quando podemos começar?',
          author: 'João Silva',
          authorId: '1',
          date: new Date('2025-01-14T10:30:00'),
        },
      ],
    },
    {
      id: '2',
      title: 'Atualização do sistema ERP',
      content: 'O sistema ERP passará por manutenção no sábado das 8h às 12h. Durante este período, o sistema ficará indisponível.',
      author: 'Carlos Oliveira',
      authorId: '3',
      authorSector: 'TI',
      date: new Date('2025-01-13'),
      reactions: [
        { type: 'like', userId: '2', userName: 'Maria Santos' },
      ],
      comments: [],
    },
  ]);

  const canPost = user?.setor === 'TI' || user?.setor === 'RH';

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast.error('Preencha todos os campos!');
      return;
    }

    const post: Post = {
      id: Date.now().toString(),
      title: newPost.title,
      content: newPost.content,
      author: user?.nome || 'Usuário',
      authorId: user?.id || '0',
      authorSector: user?.setor || '',
      date: new Date(),
      reactions: [],
      comments: [],
    };

    setPosts(prev => [post, ...prev]);
    setNewPost({ title: '', content: '' });
    setShowNewPostModal(false);
    toast.success('Publicação criada com sucesso!');
  };

  const handleReaction = async (postId: string, reactionType: 'like' | 'love') => {
    try {
      const response = await fetch(`${API_BASE}/api/mural/${postId}/like`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.points) {
          toast.success(`+${data.points} pontos! ${data.action === 'liked' ? 'Curtiu' : 'Descurtiu'} a publicação`);
        }
        // Update local state here if needed
      } else {
        toast.error('Erro ao processar reação');
      }
    } catch (error) {
      console.error('Erro ao processar reação:', error);
      toast.error('Erro ao processar reação');
    }
  };

  const handleComment = async (postId: string) => {
    const commentText = commentTexts[postId];
    if (!commentText?.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/api/mural/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ texto: commentText })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.points) {
          toast.success(`+${data.points} pontos! Comentário adicionado`);
        }
        setCommentTexts(prev => ({ ...prev, [postId]: '' }));
        // Update local state here if needed
      } else {
        toast.error('Erro ao adicionar comentário');
      }
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      toast.error('Erro ao adicionar comentário');
    }
  };

  const getUserReaction = (post: Post) => {
    return post.reactions.find(r => r.userId === user?.id);
  };

  const getReactionCount = (post: Post, type: 'like' | 'love') => {
    return post.reactions.filter(r => r.type === type).length;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Mural de Informações</h1>
          {canPost && (
            <button
              onClick={() => setShowNewPostModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Publicação</span>
            </button>
          )}
        </div>

        {/* Posts Feed */}
        <div className="space-y-6">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              {/* Post Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{post.author}</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span>{post.authorSector}</span>
                      <span>•</span>
                      <Calendar className="w-4 h-4" />
                      <span>{format(post.date, 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                    </div>
                  </div>
                </div>
                
                {(post.authorId === user?.id || isAdmin) && (
                  <div className="flex space-x-2">
                    <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Post Content */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{post.title}</h2>
                <p className="text-gray-700 leading-relaxed">{post.content}</p>
              </div>

              {/* Reactions */}
              <div className="flex items-center space-x-4 mb-4 pb-4 border-b border-gray-100">
                <button
                  onClick={() => handleReaction(post.id, 'like')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    getUserReaction(post)?.type === 'like'
                      ? 'bg-blue-100 text-blue-600'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="text-sm font-medium">{getReactionCount(post, 'like')}</span>
                </button>
                
                <button
                  onClick={() => handleReaction(post.id, 'love')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    getUserReaction(post)?.type === 'love'
                      ? 'bg-red-100 text-red-600'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  <span className="text-sm font-medium">{getReactionCount(post, 'love')}</span>
                </button>

                <div className="flex items-center space-x-2 text-gray-500">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm">{post.comments.length} comentários</span>
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-4">
                {post.comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-gray-900 text-sm">{comment.author}</span>
                          <span className="text-xs text-gray-500">
                            {format(comment.date, 'dd/MM HH:mm')}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{comment.text}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add Comment */}
                <div className="flex space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 flex space-x-2">
                    <input
                      type="text"
                      value={commentTexts[post.id] || ''}
                      onChange={(e) => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && handleComment(post.id)}
                      placeholder="Escreva um comentário..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <button
                      onClick={() => handleComment(post.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Enviar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* New Post Modal */}
        {showNewPostModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Nova Publicação</h2>
                <form onSubmit={handleCreatePost} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Título
                    </label>
                    <input
                      type="text"
                      value={newPost.title}
                      onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Digite o título da publicação..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Conteúdo
                    </label>
                    <textarea
                      value={newPost.content}
                      onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={6}
                      placeholder="Escreva o conteúdo da publicação..."
                      required
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowNewPostModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Publicar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};