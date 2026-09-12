import { NextResponse, type NextRequest } from 'next/server';

import { getSessionUser } from '@/lib/session';

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in to generate audio.' }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    return NextResponse.json({ error: 'ElevenLabs is not configured.' }, { status: 503 });
  }

  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim() || '';
  if (!text || text.length > 5000) {
    return NextResponse.json({ error: 'Provide a script section between 1 and 5,000 characters.' }, { status: 400 });
  }

  const speechResponse = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    },
  );

  if (!speechResponse.ok) {
    console.error('ElevenLabs error', speechResponse.status, await speechResponse.text());
    return NextResponse.json({ error: 'Audio generation failed.' }, { status: 502 });
  }

  return new NextResponse(await speechResponse.arrayBuffer(), {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' },
  });
}
