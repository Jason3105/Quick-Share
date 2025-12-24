import { NextResponse } from 'next/server';

/**
 * Health check endpoint for external monitoring services
 * Use this endpoint with services like:
 * - UptimeRobot (https://uptimerobot.com) - Free tier: 50 monitors, 5-minute intervals
 * - Cron-job.org (https://cron-job.org) - Free tier: Unlimited jobs
 * - Pingdom (https://pingdom.com)
 * - StatusCake (https://statuscake.com)
 * 
 * Set up a cron job to ping this endpoint every 10-12 minutes
 * to prevent Render free tier from sleeping (15-minute idle timeout)
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  
  // Log the health check
  console.log(`[Health Check] External ping received at ${timestamp}`);
  
  // Get server uptime
  const uptime = process.uptime();
  const uptimeMinutes = Math.floor(uptime / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  
  return NextResponse.json(
    { 
      status: 'healthy',
      timestamp,
      uptime: {
        seconds: Math.floor(uptime),
        minutes: uptimeMinutes,
        hours: uptimeHours,
        formatted: `${uptimeHours}h ${uptimeMinutes % 60}m`,
      },
      service: 'Quick Share P2P File Transfer',
      version: '2.0',
      endpoints: {
        ping: '/api/ping',
        health: '/api/health',
      },
    },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Service-Status': 'active',
      },
    }
  );
}

// Also support POST and HEAD methods for different monitoring services
export async function POST() {
  return GET();
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'X-Service-Status': 'active',
    },
  });
}
