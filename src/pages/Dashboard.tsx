import React from 'react';
import { Layout } from '../components/Layout';
import { 
  Calendar, 
  UtensilsCrossed, 
  Users, 
  Monitor, 
  MessageSquare,
  TrendingUp,
  Star,
  Trophy,
  Clock,
  Home
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGamification } from '../contexts/GamificationContext';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { userStats, getTopUsers, getTotalActivities, getActivityByType, getUserRank } = useGamification();

  // Icon mapping for different activity types
  const activityIcons = {
    page_visit: Home,
    protein_exchange: UtensilsCrossed,
    room_reservation: Calendar,
    reception_appointment: Users,
    post_creation: MessageSquare,
    comment: MessageSquare,
    reaction: Star,
    equipment_request: Monitor,
  };

  const stats = [
    { title: 'Salas Reservadas', value: getActivityByType('room_reservation').toString(), icon: Calendar, color: 'bg-blue-500' },
    { title: 'Trocas de Proteína', value: getActivityByType('protein_exchange').toString(), icon: UtensilsCrossed, color: 'bg-green-500' },
    { title: 'Equipamentos Solicitados', value: getActivityByType('equipment_request').toString(), icon: Monitor, color: 'bg-purple-500' },
    { title: 'Publicações no Mural', value: getActivityByType('post_creation').toString(), icon: MessageSquare, color: 'bg-orange-500' },
  ];

  const recentActivities = [
    {
      id: 1,
      type: 'reserva',
      message: 'Sala Aquário reservada para reunião',
      time: '2 horas atrás',
      icon: Calendar,
    },
    {
      id: 2,
      type: 'cardapio',
      message: 'Troca de proteína solicitada para amanhã',
      time: '4 horas atrás',
      icon: UtensilsCrossed,
    },
    {
      id: 3,
      type: 'mural',
      message: 'Nova publicação no mural de informações',
      time: '1 dia atrás',
      icon: MessageSquare,
    },
  ];

  const topUsers = getTopUsers(5);
  const userRank = getUserRank(user?.id || '');

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Olá, {user?.name?.split(' ')[0]}! 👋
              </h1>
              <p className="text-blue-100 mb-4">
                Bem-vindo de volta à Intranet do Grupo Cropfield
              </p>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-yellow-300 fill-current" />
                  <span className="font-semibold">{userStats?.totalPoints || 0} pontos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-yellow-300" />
                  <span className="font-semibold">Nível {userStats?.level || 1}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm bg-white bg-opacity-20 px-2 py-1 rounded-full">
                    #{userRank} no ranking
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="w-32 h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} rounded-lg p-3`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Atividades Recentes</h2>
              <span className="text-sm text-gray-500">{getTotalActivities()} atividades totais</span>
            </div>
            <div className="space-y-4">
              {(userStats?.activities.slice(0, 5) || recentActivities).map((activity) => (
                <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="bg-blue-100 rounded-lg p-2">
                    {(() => {
                      const IconComponent = activity.icon || activityIcons[activity.type as keyof typeof activityIcons] || Home;
                      return <IconComponent className="w-5 h-5 text-blue-600" />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.description || activity.message}
                    </p>
                    <div className="flex items-center space-x-1 mt-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <p className="text-xs text-gray-500">
                        {activity.timestamp ? new Date(activity.timestamp).toLocaleString('pt-BR') : activity.time}
                      </p>
                      {activity.points && (
                        <>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-green-600">+{activity.points} pts</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Users Ranking */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Ranking de Usuários</h2>
            <div className="space-y-4">
              {topUsers.map((topUser, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                    <img
                      src={topUser.userAvatar}
                      alt={topUser.userName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-gray-900">{topUser.userName}</p>
                      {topUser.userId === user?.id && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Você</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 mt-1">
                      <div className="flex items-center space-x-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                        <span className="text-xs text-gray-600">{topUser.totalPoints} pts</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Trophy className="w-3 h-3 text-blue-500" />
                        <span className="text-xs text-gray-600">Nível {topUser.level}</span>
                      </div>
                      {topUser.badges.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-purple-600">{topUser.badges[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Badges */}
        {userStats && userStats.badges.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Suas Conquistas</h2>
            <div className="flex flex-wrap gap-2">
              {userStats.badges.map((badge, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-full"
                >
                  🏆 {badge}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};