import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { message, level, metadata } = await req.json();
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[Client:${level || 'INFO'}]`;
    
    console.log(`${timestamp} ${prefix} ${message}`, metadata ? JSON.stringify(metadata) : '');
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
