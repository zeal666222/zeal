'use client';
import {useState} from 'react';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {motion} from 'framer-motion';
import {Card, CardContent, Badge, Button} from '@zeal/ui';
import { Calendar, Check, ChevronLeft, ChevronRight, Filter, RefreshCw, Search, X } from "lucide-react";
import {LoadingState} from '@/components/shared/LoadingState';
import {EmptyState} from '@/components/shared/EmptyState';
import {ErrorBoundary} from '@/components/shared/ErrorBoundary';
import {useAdminStore} from '@/lib/store/adminStore';

function BookingsContent() {
 const { profile } = useAdminStore();
 const [filter, setFilter] = useState('all');
 const [page, setPage] = useState(1);
 const limit = 10;
 const queryClient = useQueryClient();

 const { data, isLoading, error, refetch } = useQuery({
 queryKey: ['admin', 'bookings', filter, page],
 queryFn: async () => {
 const res = await fetch(`/api/admin/bookings?status=${filter}&page=${page}&limit=${limit}`);
 if (!res.ok) throw new Error('Failed to fetch bookings');
 return res.json();
 },
 });

 const updateStatus = useMutation({
 mutationFn: async ({ id, status }: { id: string; status: string }) => {
 const res = await fetch(`/api/admin/bookings/${id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ status }),
 });
 if (!res.ok) throw new Error('Failed to update booking');
 return res.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
 },
 });

 if (isLoading) return <LoadingState />;
 if (error) {
 return (
 <div className="glass-card-3d p-6 text-center text-red-500">
 <p>Failed to load bookings: {(error as Error).message}</p>
 <button onClick={() => refetch()} className="mt-2 text-[var(--color-primary)] hover:underline">
 Retry
 </button>
 </div>
 );
 }

 const bookings = data?.items || [];
 const total = data?.total || 0;
 const totalPages = Math.ceil(total / limit);

 if (bookings.length === 0) {
 return <EmptyState icon={Calendar} title="No Bookings" description="No bookings match your current filters." />;
 }

 return (
 <div>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
 <div className="flex items-center gap-2 flex-wrap">
 <select
 value={filter}
 onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value)}
 className="px-3 py-2 rounded-xl glass border border-border text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none w-full sm:w-auto"
 >
 <option value="all">All</option>
 <option value="pending">Pending</option>
 <option value="confirmed">Confirmed</option>
 <option value="completed">Completed</option>
 <option value="cancelled">Cancelled</option>
 </select>
 <button onClick={() => refetch()} className="p-2 rounded-full hover:bg-[var(--color-surface-sunken)] dark:hover:bg-gray-800 transition-colors">
 <RefreshCw className="w-5 h-5 text-[var(--color-subtle-foreground)]" />
 </button>
 </div>
 <div className="text-sm text-[var(--color-subtle-foreground)] dark:text-gray-400">
 {total} bookings
 </div>
 </div>

 {/* Mobile card view */}
 <div className="block sm:hidden space-y-4">
 {bookings.map((b: { id: string; status: string; scheduledAt: string; amount: number; user?: { name?: string | null } | null; consultant?: { user?: { name?: string | null } | null } | null }) => (
 <div key={b.id} className="glass-card-3d p-4">
 <div className="flex items-start justify-between">
 <div>
 <p className="font-medium text-muted-foreground">{b.user?.name || 'N/A'}</p>
 <p className="text-sm text-[var(--color-subtle-foreground)] dark:text-gray-400">{b.consultant?.user?.name || 'N/A'}</p>
 </div>
 <Badge variant={
 b.status === 'confirmed' ? 'success' :
 b.status === 'pending' ? 'warning' :
 b.status === 'cancelled' ? 'destructive' :
 'secondary'
 }>
 {b.status}
 </Badge>
 </div>
 <div className="mt-2 flex items-center justify-between text-sm">
 <span className="text-muted-foreground">{new Date(b.scheduledAt).toLocaleDateString()}</span>
 <span className="text-[var(--color-primary)]">₹{b.amount}</span>
 </div>
 {b.status === 'pending' && (
 <div className="mt-3 flex gap-2">
 <button
 onClick={() => updateStatus.mutate({ id: b.id, status: 'confirmed' })}
 className="flex-1 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-sm"
 >
 Confirm
 </button>
 <button
 onClick={() => updateStatus.mutate({ id: b.id, status: 'cancelled' })}
 className="flex-1 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors text-sm"
 >
 Cancel
 </button>
 </div>
 )}
 </div>
 ))}
 </div>

 {/* Desktop table view */}
 <div className="hidden sm:block overflow-x-auto">
 <table className="w-full">
 <thead className="bg-[var(--color-surface-sunken)] ">
 <tr>
 <th className="text-left p-3 text-xs font-medium text-muted-foreground">User</th>
 <th className="text-left p-3 text-xs font-medium text-muted-foreground">Consultant</th>
 <th className="text-left p-3 text-xs font-medium text-muted-foreground">Date</th>
 <th className="text-left p-3 text-xs font-medium text-muted-foreground">Amount</th>
 <th className="text-left p-3 text-xs font-medium text-muted-foreground">Status</th>
 <th className="text-left p-3 text-xs font-medium text-muted-foreground">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--color-primary-muted)] dark:divide-gray-700">
 {bookings.map((b: { id: string; status: string; scheduledAt: string; amount: number; user?: { name?: string | null } | null; consultant?: { user?: { name?: string | null } | null } | null }) => (
 <tr key={b.id} className="hover:bg-[var(--color-surface-sunken)] dark:hover:bg-gray-800/50 transition-colors">
 <td className="p-3 text-sm text-muted-foreground">{b.user?.name || 'N/A'}</td>
 <td className="p-3 text-sm text-muted-foreground">{b.consultant?.user?.name || 'N/A'}</td>
 <td className="p-3 text-sm text-muted-foreground">{new Date(b.scheduledAt).toLocaleDateString()}</td>
 <td className="p-3 text-sm text-muted-foreground">₹{b.amount}</td>
 <td className="p-3"><Badge variant={
 b.status === 'confirmed' ? 'success' :
 b.status === 'pending' ? 'warning' :
 b.status === 'cancelled' ? 'destructive' :
 'secondary'
 }>{b.status}</Badge></td>
 <td className="p-3 flex gap-2">
 {b.status === 'pending' && (
 <>
 <button onClick={() => updateStatus.mutate({ id: b.id, status: 'confirmed' })} className="p-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors"><Check className="w-4 h-4" /></button>
 <button onClick={() => updateStatus.mutate({ id: b.id, status: 'cancelled' })} className="p-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"><X className="w-4 h-4" /></button>
 </>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex items-center justify-between mt-4">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={page === 1}
 className="p-2 rounded-lg hover:bg-[var(--color-surface-sunken)] dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
 >
 <ChevronLeft className="w-5 h-5" />
 </button>
 <span className="text-sm text-[var(--color-subtle-foreground)] dark:text-gray-400">Page {page} of {totalPages}</span>
 <button
 onClick={() => setPage(p => Math.min(totalPages, p + 1))}
 disabled={page === totalPages}
 className="p-2 rounded-lg hover:bg-[var(--color-surface-sunken)] dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
 >
 <ChevronRight className="w-5 h-5" />
 </button>
 </div>
 )}
 </div>
 );
}

export default function BookingsPage() {
 return (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
 <div className="flex items-center justify-between mb-4">
 <h1 className="text-xl sm:text-2xl font-bold text-muted-foreground">Bookings</h1>
 </div>
 <ErrorBoundary>
 <BookingsContent />
 </ErrorBoundary>
 </motion.div>
 );
}
