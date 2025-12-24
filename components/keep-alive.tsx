"use client";

import { useEffect } from 'react';

export function KeepAlive() {
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const pingServer = async () => {
      try {
        const response = await fetch('/api/ping', {
          method: 'GET',
          cache: 'no-cache',
        });
        
        if (response.ok) {
          retryCount = 0; // Reset retry count on success
          console.log('Keep-alive ping successful');
        } else {
          throw new Error(`Ping failed with status: ${response.status}`);
        }
      } catch (error) {
        retryCount++;
        console.log(`Keep-alive ping failed (attempt ${retryCount}/${maxRetries}):`, error);
        
        // Retry immediately if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          setTimeout(() => pingServer(), 5000); // Retry after 5 seconds
        } else {
          retryCount = 0; // Reset for next interval
        }
      }
    };

    // Ping every 5 minutes (300000ms) to keep Render server active
    // Render free tier sleeps after 15 minutes of inactivity
    const interval = setInterval(pingServer, 5 * 60 * 1000); // 5 minutes

    // Initial ping
    pingServer();

    return () => clearInterval(interval);
  }, []);

  return null;
}
