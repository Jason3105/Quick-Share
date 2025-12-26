"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home, FileQuestion, Rocket, Gift } from "lucide-react";

export default function NotFound() {
  const router = useRouter();
  const [clicks, setClicks] = useState(0);
  const [showSecret, setShowSecret] = useState(false);

  const messages = [
    "Oops! This file got lost in the P2P network 🌐",
    "404: Page not found in any peer 🔍",
    "This URL took a wrong turn in the WebRTC tunnel 🚇",
    "Error: No peers available for this page 📡",
    "Looks like this page went offline 💤"
  ];

  const [message, setMessage] = useState(messages[0]);

  useEffect(() => {
    setMessage(messages[Math.floor(Math.random() * messages.length)]);
  }, []);

  const createConfetti = () => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.animationDelay = Math.random() * 3 + 's';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 4000);
    }
  };

  const handleLogoClick = () => {
    const newClicks = clicks + 1;
    setClicks(newClicks);
    
    if (newClicks === 7) {
      setShowSecret(true);
      createConfetti();
      setClicks(0); // Reset counter for potential future triggers
    }
  };

  return (
    <>
      <style jsx global>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
          }
        }
        .confetti {
          position: fixed;
          width: 10px;
          height: 10px;
          top: -10px;
          z-index: 9999;
          animation: fall 3s linear forwards;
        }
      `}</style>

      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-6 sm:space-y-8">
          {/* Animated 404 */}
          <div className="relative">
            <div 
              className="text-[120px] sm:text-[150px] md:text-[200px] font-bold text-primary/10 select-none cursor-pointer transition-all hover:scale-105 active:scale-95"
              onClick={handleLogoClick}
            >
              404
            </div>
            <FileQuestion 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 text-primary/30 pointer-events-none"
              strokeWidth={1.5}
            />
          </div>

          {/* Message */}
          <div className="space-y-3 sm:space-y-4 px-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              {message}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto">
              The page you're looking for doesn't exist. Maybe it was transferred to another dimension? 🌌
            </p>
          </div>

          {/* Secret Message */}
          {showSecret && (
            <Card className="p-6 sm:p-8 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 border-2 border-primary shadow-2xl mx-4">
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Rocket className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 animate-bounce" />
                  <h2 className="text-xl sm:text-2xl font-bold">🎊 LEGENDARY! 🎊</h2>
                  <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-pink-500 animate-bounce" />
                </div>
                <p className="text-base sm:text-lg">
                  You've unlocked the secret achievement!<br />
                  <span className="text-xs sm:text-sm text-muted-foreground mt-2 block">
                    Easter Egg: "Seven Clicks Master" 🏆<br />
                    Fun fact: This 404 page has better secrets than most treasure hunts! 
                  </span>
                </p>
                <p className="text-xs text-muted-foreground italic">
                  P.S. - Quick Share is the fastest way to share files, but finding this easter egg? That takes true dedication! 😎
                </p>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-4 px-4">
            <Button 
              size="lg" 
              onClick={() => router.push('/')}
              className="gap-2 w-full sm:w-auto sm:min-w-[200px]"
            >
              <Home className="w-5 h-5" />
              Back to Home
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => router.push('/send')}
              className="gap-2 w-full sm:w-auto sm:min-w-[200px]"
            >
              <Rocket className="w-5 h-5" />
              Send Files
            </Button>
          </div>

          {/* Hint */}
          <p className="text-xs sm:text-sm text-muted-foreground pt-6 sm:pt-8 px-4">
            💡 <span className="italic">Hint: Try clicking the big 404 above... 7 times 😉</span>
          </p>
        </div>
      </main>
    </>
  );
}
