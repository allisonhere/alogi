import { NextResponse } from 'next/server';
import { validateSudoPassword, setSudoPassword } from '@/lib/sudo';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ ok: false, error: 'Password is required' }, { status: 400 });
  }

  if (validateSudoPassword(password)) {
    setSudoPassword(password);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 401 });
}
