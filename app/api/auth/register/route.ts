import { hash } from 'bcryptjs';
import { MongoServerError } from 'mongodb';
import { NextResponse, type NextRequest } from 'next/server';

import { getDatabase } from '@/lib/mongodb';
import { AccountConfigurationError, accountConfigurationMessage, assertAccountConfiguration } from '@/lib/account-config';
import { attachSessionCookie, createSessionToken } from '@/lib/session';

type UserDocument = { email: string; name: string; passwordHash: string; createdAt: Date };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };
    const name = body.name?.trim().slice(0, 80) || '';
    const email = body.email?.trim().toLowerCase().slice(0, 254) || '';
    const password = body.password || '';

    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return NextResponse.json({ error: 'Enter a name, valid email, and password of at least 8 characters.' }, { status: 400 });
    }

    // Check session configuration before inserting an account so a missing secret
    // cannot leave a created account behind after a failed signup response.
    assertAccountConfiguration();
    const db = await getDatabase();
    const users = db.collection<UserDocument>('users');
    await users.createIndex({ email: 1 }, { unique: true });
    const result = await users.insertOne({ email, name, passwordHash: await hash(password, 12), createdAt: new Date() });
    const user = { id: result.insertedId.toString(), email, name };
    const response = NextResponse.json({ user }, { status: 201 });
    attachSessionCookie(response, await createSessionToken(user));
    return response;
  } catch (error) {
    if (error instanceof AccountConfigurationError) {
      return NextResponse.json({ error: accountConfigurationMessage(error) }, { status: 503 });
    }
    if (error instanceof MongoServerError && error.code === 11000) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
    console.error('Registration failed', error);
    return NextResponse.json({ error: 'Account setup is unavailable. Check the server configuration.' }, { status: 500 });
  }
}
