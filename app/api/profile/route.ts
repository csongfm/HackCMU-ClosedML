import { NextResponse, type NextRequest } from 'next/server';

import { getDatabase } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/session';
import { normalizeProfile, type ListenerProfile } from '@/lib/preferences';

export async function PUT(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in to save your profile.' }, { status: 401 });

  let profile: ListenerProfile;
  try {
    profile = normalizeProfile(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid profile.' }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const profiles = db.collection('profiles');
    await profiles.createIndex({ userId: 1 }, { unique: true });
    await profiles.updateOne(
      { userId: user.id },
      { $set: { ...profile, userId: user.id, updatedAt: new Date() }, $unset: { team: '' }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Profile save failed', error);
    return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 });
  }
}
