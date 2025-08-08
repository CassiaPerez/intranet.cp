import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface UserActivity {
  id: string;
  userId: string;
  userName: string;
  type: 'page_visit' | 'protein_exchange' | 'room_reservation' | 'reception_appointment' | 'post_creation' | 'comment' | 'reaction' | 'equipment_request';
  description: string;
  points: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface UserStats {
  userId: string;
  userName: string;
  userSector: string;
  userAvatar: string;
  totalPoints: number;
  level: number;
  activities: UserActivity[];
  badges: string[];
  streak: number;
  lastActivity: Date;
}

interface GamificationContextType {
  userStats: UserStats | null;
  allUsersStats: UserStats[];
  addActivity: (
    type: UserActivity['type'],
    description: string,
    metadata?: Record<string, unknown>
  ) => void;
  getUserRank: (userId: string) => number;
  getTopUsers: (limit?: number) => UserStats[];
  getTotalActivities: () => number;
  getActivityByType: (type: UserActivity['type']) => number;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
};

interface GamificationProviderProps {
  children: ReactNode;
}

// Point system configuration
const POINT_VALUES = {
  page_visit: 1,
  protein_exchange: 5,
  room_reservation: 8,
  reception_appointment: 6,
  post_creation: 15,
  comment: 3,
  reaction: 2,
  equipment_request: 4,
};

// Level calculation
const calculateLevel = (points: number): number => {
  if (points < 100) return 1;
  if (points < 300) return 2;
  if (points < 600) return 3;
  if (points < 1000) return 4;
  if (points < 1500) return 5;
  if (points < 2200) return 6;
  if (points < 3000) return 7;
  if (points < 4000) return 8;
  if (points < 5500) return 9;
  return 10;
};

// Badge system
const calculateBadges = (stats: UserStats): string[] => {
  const badges: string[] = [];
  const activities = stats.activities;
  
  // Activity-based badges
  if (activities.filter(a => a.type === 'post_creation').length >= 5) badges.push('Comunicador');
  if (activities.filter(a => a.type === 'room_reservation').length >= 10) badges.push('Organizador');
  if (activities.filter(a => a.type === 'protein_exchange').length >= 15) badges.push('Gourmet');
  if (activities.filter(a => a.type === 'comment').length >= 20) badges.push('Sociável');
  if (activities.filter(a => a.type === 'reaction').length >= 50) badges.push('Engajado');
  
  // Point-based badges
  if (stats.totalPoints >= 500) badges.push('Ativo');
  if (stats.totalPoints >= 1000) badges.push('Veterano');
  if (stats.totalPoints >= 2000) badges.push('Expert');
  if (stats.totalPoints >= 3000) badges.push('Lenda');
  
  // Streak badges
  if (stats.streak >= 7) badges.push('Consistente');
  if (stats.streak >= 30) badges.push('Dedicado');
  
  return badges;
};

export const GamificationProvider: React.FC<GamificationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [allUsersStats, setAllUsersStats] = useState<UserStats[]>([]);

  const addActivity = useCallback(
    (
      type: UserActivity['type'],
      description: string,
      metadata?: Record<string, unknown>
    ) => {
      if (!user || !userStats) return;

      const points = POINT_VALUES[type] || 1;
      const activity: UserActivity = {
        id: Date.now().toString(),
        userId: user.id,
        userName: user.name,
        type,
        description,
        points,
        timestamp: new Date(),
        metadata,
      };

      const updatedStats = allUsersStats.map(stats => {
        if (stats.userId === user.id) {
          const newActivities = [activity, ...stats.activities];
          const newTotalPoints = stats.totalPoints + points;
          const newLevel = calculateLevel(newTotalPoints);

          // Calculate streak
          const today = new Date().toDateString();
          const lastActivityDate = stats.lastActivity ? new Date(stats.lastActivity).toDateString() : '';
          const newStreak = lastActivityDate === today ? stats.streak : stats.streak + 1;

          const updatedUserStats = {
            ...stats,
            activities: newActivities,
            totalPoints: newTotalPoints,
            level: newLevel,
            streak: newStreak,
            lastActivity: new Date(),
          };

          // Calculate badges
          updatedUserStats.badges = calculateBadges(updatedUserStats);

          setUserStats(updatedUserStats);
          return updatedUserStats;
        }
        return stats;
      });

      setAllUsersStats(updatedStats);
      localStorage.setItem('gamification_stats', JSON.stringify(updatedStats));
    },
    [user, userStats, allUsersStats]
  );

  // Initialize with mock data
  useEffect(() => {
    const mockStats: UserStats[] = [
      {
        userId: '1',
        userName: 'Maria Santos',
        userSector: 'RH',
        userAvatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=150',
        totalPoints: 1450,
        level: 6,
        activities: [],
        badges: ['Comunicador', 'Ativo', 'Veterano', 'Sociável'],
        streak: 12,
        lastActivity: new Date('2025-01-15T14:30:00'),
      },
      {
        userId: '2',
        userName: 'João Silva',
        userSector: 'Financeiro',
        userAvatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?w=150',
        totalPoints: 1250,
        level: 5,
        activities: [],
        badges: ['Organizador', 'Ativo', 'Engajado'],
        streak: 8,
        lastActivity: new Date('2025-01-15T10:15:00'),
      },
      {
        userId: '3',
        userName: 'Carlos Oliveira',
        userSector: 'TI',
        userAvatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?w=150',
        totalPoints: 980,
        level: 4,
        activities: [],
        badges: ['Gourmet', 'Consistente'],
        streak: 15,
        lastActivity: new Date('2025-01-15T16:45:00'),
      },
      {
        userId: '4',
        userName: 'Ana Costa',
        userSector: 'Vendas',
        userAvatar: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?w=150',
        totalPoints: 750,
        level: 3,
        activities: [],
        badges: ['Sociável'],
        streak: 5,
        lastActivity: new Date('2025-01-15T09:20:00'),
      },
    ];

    // Load from localStorage or use mock data
    const savedStats = localStorage.getItem('gamification_stats');
    if (savedStats) {
      const parsedStats = JSON.parse(savedStats);
      setAllUsersStats(parsedStats);
    } else {
      setAllUsersStats(mockStats);
      localStorage.setItem('gamification_stats', JSON.stringify(mockStats));
    }
  }, []);

    // Update user stats when user changes
    useEffect(() => {
      if (user && allUsersStats.length > 0) {
        let currentUserStats = allUsersStats.find(stats => stats.userId === user.id);
      
      if (!currentUserStats) {
        // Create new user stats
        currentUserStats = {
          userId: user.id,
          userName: user.name,
          userSector: user.sector,
          userAvatar: user.avatar || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?w=150',
          totalPoints: 0,
          level: 1,
          activities: [],
          badges: [],
          streak: 0,
          lastActivity: new Date(),
        };
        
        const updatedStats = [...allUsersStats, currentUserStats];
        setAllUsersStats(updatedStats);
        localStorage.setItem('gamification_stats', JSON.stringify(updatedStats));
      }
      
        setUserStats(currentUserStats);
      }
    }, [user, allUsersStats]);

    // Track initial page visit once per session
    const hasTrackedVisit = useRef(false);

    useEffect(() => {
      if (user && userStats && !hasTrackedVisit.current) {
        addActivity('page_visit', 'Acessou a intranet');
        hasTrackedVisit.current = true;
      }
    }, [user, userStats, addActivity]);

    useEffect(() => {
      hasTrackedVisit.current = false;
    }, [user?.id]);

    const getUserRank = (userId: string): number => {
    const sortedUsers = [...allUsersStats].sort((a, b) => b.totalPoints - a.totalPoints);
    return sortedUsers.findIndex(user => user.userId === userId) + 1;
  };

  const getTopUsers = (limit: number = 10): UserStats[] => {
    return [...allUsersStats]
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit);
  };

  const getTotalActivities = (): number => {
    return allUsersStats.reduce((total, user) => total + user.activities.length, 0);
  };

  const getActivityByType = (type: UserActivity['type']): number => {
    return allUsersStats.reduce((total, user) => {
      return total + user.activities.filter(activity => activity.type === type).length;
    }, 0);
  };

  return (
    <GamificationContext.Provider
      value={{
        userStats,
        allUsersStats,
        addActivity,
        getUserRank,
        getTopUsers,
        getTotalActivities,
        getActivityByType,
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
};
