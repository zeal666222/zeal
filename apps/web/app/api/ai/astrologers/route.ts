import { NextResponse } from 'next/server';
import { createAdminClient } from '@zeal/database/server';
import { withErrorHandler, AppError, ErrorCode } from '@/lib/errors';

export const dynamic = 'force-dynamic';

interface AIConsultantRow {
  id: string;
  name: string | null;
  username: string | null;
  category: string | null;
  specialties: string[] | null;
  rating: number | null;
  isPaid: boolean | null;
  perMinuteRate: number | null;
  avatar: string | null;
}

export const GET = withErrorHandler(async () => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('AIConsultant')
    .select('id, name, username, category, specialties, rating, isPaid, perMinuteRate, avatar')
    .eq('isActive', true)
    .order('isFeatured', { ascending: false })
    .order('rating', { ascending: false });

  if (error) throw new AppError(error.message, 500, ErrorCode.INTERNAL_SERVER);

  const astrologers = ((data ?? []) as unknown as AIConsultantRow[]).map((r) => ({
    id: r.id,
    name: r.name ?? 'AI Astrologer',
    username: r.username,
    specialty: (r.specialties && r.specialties[0]) || r.category || 'Vedic Astrology',
    isFree: !r.isPaid,
    perMinuteRate: r.isPaid ? Number(r.perMinuteRate ?? 0) : 0,
    rating: Number(r.rating ?? 0),
    avatar: r.avatar,
  }));

  return NextResponse.json(astrologers, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
});
