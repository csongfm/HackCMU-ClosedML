import { DatabaseConnectionError, databaseConnectionMessage } from '@/lib/connection-deadline';
import { compare } from 'bcryptjs';
import { NextResponse, type NextRequest } from 'next/server';

import { getDatabase } from '@/lib/mongodb';
import { AccountConfigurationError, accountConfigurationMessage, assertAccountConfiguration } from '@/lib/account-config';
import { attachSessionCookie, createSessionToken } from '@/lib/session';

type UserDocument = { email: string; name: string; passwordHash: string };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() || '';
    const password = body.password || '';
    assertAccountConfiguration();
    const db = await getDatabase();
    const existing = await db.collection<UserDocument>('users').findOne({ email });

    if (!existing || !(await compare(password, existing.passwordHash))) {
      return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
    }

    const user = { id: existing._id.toString(), email: existing.email, name: existing.name };
    const response = NextResponse.json({ user });
    attachSessionCookie(response, await createSessionToken(user));
    return response;
  } catch (error) {
    if (error instanceof DatabaseConnectionError) {
      return NextResponse.json({ error: databaseConnectionMessage() }, { status: 503 });
    }
    if (error instanceof AccountConfigurationError) {
      return NextResponse.json({ error: accountConfigurationMessage(error) }, { status: 503 });
    }
    console.error('Login failed', error);
    return NextResponse.json({ error: 'Sign in is unavailable. Check the server configuration.' }, { status: 500 });
  }
}
