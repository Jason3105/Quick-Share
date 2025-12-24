import { NextResponse } from 'next/server';

export async function GET() {
  const timestamp = new Date().toISOString();
  console.log(`[Ping API] Received keep-alive ping at ${timestamp}`);
  
  return NextResponse.json(
    { 
      status: 'alive',
      timestamp,
      message: 'Server is active',
    },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}

// Also handle POST for external monitoring services
export async function POST() {
  return GET();
}
