'use client';
import { useQuery } from '@tanstack/react-query';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { useAdminStore } from '@/lib/store/adminStore';
import { Calendar, DollarSign, Phone, Star, Users } from 'lucide-react';

export default function ConsultantDashboard() {
  const { profile } = useAdminStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['consultant', 'stats', profile?.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/consultants/${profile?.consultantId}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!profile?.id,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#5E4B8B] dark:text-white">
          Welcome back, {profile?.name || 'Consultant'}
        </h1>
        <span className="text-sm text-[#B8A1D9] dark:text-gray-400">Online</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Bookings" value={stats?.totalBookings || 0} icon={Calendar} color="purple" />
        <StatsCard label="Earnings" value={`₹${stats?.earnings || 0}`} icon={DollarSign} color="gold" />
        <StatsCard label="Calls" value={stats?.totalCalls || 0} icon={Phone} color="blue" />
        <StatsCard label="Rating" value={stats?.rating || 0} icon={Star} color="green" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RevenueChart />
        <div className="glass-card-3d p-4">
          <h3 className="font-semibold text-[#5E4B8B] dark:text-white">Upcoming Bookings</h3>
          {stats?.upcomingBookings?.length ? (
            stats.upcomingBookings.map((b: { id: string; userName?: string; scheduledAt: string; status: string }) => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-[#E1C5E7]/30 dark:border-gray-700/30">
                <div>
                  <p className="text-sm text-[#5E4B8B] dark:text-white">{b.userName}</p>
                  <p className="text-xs text-[#B8A1D9] dark:text-gray-400">{b.scheduledAt}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  b.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {b.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-[#B8A1D9] dark:text-gray-400 mt-2">No upcoming bookings</p>
          )}
        </div>
      </div>
    </div>
  );
}
