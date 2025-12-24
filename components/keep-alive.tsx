"use client";

import { useEffect } from 'react';

export function KeepAlive() {
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    let isActive = true;

    const pingServer = async () => {
      if (!isActive) return;
      
      try {
        const response = await fetch('/api/ping', {
          method: 'GET',
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        
        if (response.ok) {
          retryCount = 0; // Reset retry count on success
          const data = await response.json();
          console.log('✅ Keep-alive ping successful:', data.timestamp);
        } else {
          throw new Error(`Ping failed with status: ${response.status}`);
        }
      } catch (error) {
        retryCount++;
        console.warn(`⚠️ Keep-alive ping failed (attempt ${retryCount}/${maxRetries}):`, error);
        
        // Retry immediately if we haven't exceeded max retries
        if (retryCount < maxRetries && isActive) {
          setTimeout(() => pingServer(), 3000); // Retry after 3 seconds
        } else {
          retryCount = 0; // Reset for next interval
        }
      }
    };

    // Ping every 8 minutes (480000ms) to keep Render server active
    // Render free tier sleeps after 15 minutes of inactivity
    // We ping at 8 minutes to have a safety margin
    const PING_INTERVAL = 8 * 60 * 1000; // 8 minutes
    const interval = setInterval(pingServer, PING_INTERVAL);

    // Initial ping after 2 seconds (give page time to load)
    const initialPingTimeout = setTimeout(() => {
      console.log('🚀 Keep-alive system started');
      pingServer();
    }, 2000);

    return () => {
      isActive = false;
      clearInterval(interval);
      clearTimeout(initialPingTimeout);
      console.log('🛑 Keep-alive system stopped');
    };
  }, []);

  return null;
}
