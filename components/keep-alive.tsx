"use client";

import { useEffect } from 'react';

export function KeepAlive() {
  useEffect(() => {
    // Ping every 8 minutes (480000ms) to keep server active
    const interval = setInterval(async () => {
      try {
        await fetch('/api/ping');
      } catch (error) {
        console.log('Keep-alive ping failed:', error);
      }
    }, 8 * 60 * 1000); // 8 minutes

    // Initial ping
    fetch('/api/ping').catch(() => {});

    return () => clearInterval(interval);
  }, []);

  return null;
}
