import { NextResponse, type NextRequest } from 'next/server';

import { getDatabase } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session';
import { normalizeProfile } from '@/lib/preferences';


export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  try {
    const db = await getDatabase();
    const profile = await db.collection('profiles').findOne({ userId: user.id });
    return NextResponse.json({
      user,
      profile: profile
        ? normalizeProfile(profile)
        : undefined,
    });
  } catch (error) {
    console.error('Session lookup failed', error);
    return NextResponse.json({ error: 'Could not reach your profile database. Please retry. If this continues, check MongoDB Atlas network access.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
