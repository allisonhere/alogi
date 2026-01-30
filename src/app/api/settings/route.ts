import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/config';

export async function GET() {
  const config = getConfig();
  // Mask API key for security if needed, but for local app it's often fine to show it
  // or show it masked.
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    saveConfig(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
