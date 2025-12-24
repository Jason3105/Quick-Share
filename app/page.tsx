"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { FileSender } from "@/components/file-sender";
import { FileReceiver } from "@/components/file-receiver";
import { Logo } from "@/components/logo";
import { Share2, Download, Zap, Shield, Infinity, Lock, Github, CheckCircle2, Users, Globe, Sparkles, ArrowRight, MessageSquare, FileText, Video, Image as ImageIcon, Music } from "lucide-react";

export default function Home() {
  const [mode, setMode] = useState<"send" | "receive" | null>(null);
  const [roomCodeFromUrl, setRoomCodeFromUrl] = useState<string>("");

  useEffect(() => {
    // Check for room code in URL parameters
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room");
    
    if (roomCode) {
      setRoomCodeFromUrl(roomCode);
      setMode("receive");
      // Clean up URL without page reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const reset = () => {
    setMode(null);
    setRoomCodeFromUrl("");
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-3">
              <Logo className="h-8 w-8 sm:h-10 sm:w-10 text-foreground" />
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-foreground">
                  Quick Share
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">P2P File Transfer</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {!mode && (
          <>
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-950 p-8 sm:p-12 lg:p-16 mb-8 sm:mb-12 lg:mb-16">
              <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
              <div className="relative text-center space-y-6 sm:space-y-8">
                <div className="inline-block animate-float">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-400 dark:bg-blue-600 blur-2xl opacity-30 rounded-full"></div>
                    <Logo className="relative h-20 w-20 sm:h-24 sm:w-24 mx-auto text-foreground" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm font-medium">
                    <Sparkles className="h-4 w-4" />
                    <span>100% Free & Open Source</span>
                  </div>
                  <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground leading-tight px-4">
                    Share Files at
                    <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent"> Lightning Speed</span>
                  </h2>
                  <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto px-4 leading-relaxed">
                    Secure peer-to-peer file sharing powered by WebRTC. No servers, no storage, no limits. Just instant transfers.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                  <Button size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all" onClick={() => setMode("send")}>
                    Start Sharing Now
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <Button size="lg" variant="outline" className="text-lg px-8 py-6" onClick={() => setMode("receive")}>
                    Receive Files
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-16">
              <Card className="p-6 text-center border-2 hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-lg">
                <div className="text-3xl sm:text-4xl font-bold text-foreground mb-2">∞</div>
                <div className="text-sm text-muted-foreground">File Size Limit</div>
              </Card>
              <Card className="p-6 text-center border-2 hover:border-green-500 dark:hover:border-green-400 transition-all hover:shadow-lg">
                <div className="text-3xl sm:text-4xl font-bold text-foreground mb-2">0ms</div>
                <div className="text-sm text-muted-foreground">Server Delay</div>
              </Card>
              <Card className="p-6 text-center border-2 hover:border-purple-500 dark:hover:border-purple-400 transition-all hover:shadow-lg">
                <div className="text-3xl sm:text-4xl font-bold text-foreground mb-2">100%</div>
                <div className="text-sm text-muted-foreground">Encrypted</div>
              </Card>
              <Card className="p-6 text-center border-2 hover:border-orange-500 dark:hover:border-orange-400 transition-all hover:shadow-lg">
                <div className="text-3xl sm:text-4xl font-bold text-foreground mb-2">$0</div>
                <div className="text-sm text-muted-foreground">Forever Free</div>
              </Card>
            </div>

            {/* Why Choose Quick Share */}
            <div className="mb-12 sm:mb-16">
              <div className="text-center mb-8">
                <h3 className="text-2xl sm:text-3xl font-bold mb-3">Why Choose Quick Share?</h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">Experience the fastest, most secure way to share files across devices</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 border-2">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
                    <Infinity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No File Size Limits</h3>
                  <p className="text-sm text-muted-foreground">Transfer files of any size - from documents to 4K videos, without restrictions</p>
                </Card>
                <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 border-2">
                  <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">End-to-End Encrypted</h3>
                  <p className="text-sm text-muted-foreground">Your files are encrypted during transfer. We never see or store your data</p>
                </Card>
                <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 border-2">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-4">
                    <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Lightning Fast</h3>
                  <p className="text-sm text-muted-foreground">Direct peer-to-peer connections mean maximum speed with no server bottlenecks</p>
                </Card>
                <Card className="p-6 hover:shadow-xl transition-all hover:-translate-y-1 border-2">
                  <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center mb-4">
                    <Lock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Zero Storage</h3>
                  <p className="text-sm text-muted-foreground">Files transfer directly between devices. Nothing is saved on our servers</p>
                </Card>
              </div>
            </div>

            {/* Use Cases */}
            <Card className="mb-12 p-8 bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-900 border-2">
              <div className="text-center mb-8">
                <h3 className="text-2xl sm:text-3xl font-bold mb-3">Perfect For Every Need</h3>
                <p className="text-muted-foreground">Share anything, anywhere, anytime</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Work Documents</h4>
                    <p className="text-sm text-muted-foreground">Share presentations, PDFs, and reports instantly</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                    <ImageIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Photos & Images</h4>
                    <p className="text-sm text-muted-foreground">Transfer high-res photos without compression</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0">
                    <Video className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Videos</h4>
                    <p className="text-sm text-muted-foreground">Send large video files at full quality</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                    <Music className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Music & Audio</h4>
                    <p className="text-sm text-muted-foreground">Share lossless audio files and recordings</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Team Collaboration</h4>
                    <p className="text-sm text-muted-foreground">Quick file sharing during meetings</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
                    <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Cross-Platform</h4>
                    <p className="text-sm text-muted-foreground">Works on any device with a browser</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Main Action Cards */}
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              <Card className="p-6 sm:p-8 hover:bg-accent transition-all cursor-pointer border-2" onClick={() => setMode("send")}>
                <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-foreground flex items-center justify-center">
                    <Share2 className="h-8 w-8 sm:h-10 sm:w-10 text-background" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold">Send Files</h2>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Upload files and generate a secure auto-rotating QR code for sharing
                  </p>
                  <Button size="lg" className="w-full">
                    Start Sending
                  </Button>
                </div>
              </Card>

              <Card className="p-6 sm:p-8 hover:bg-accent transition-all cursor-pointer border-2" onClick={() => setMode("receive")}>
                <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-foreground flex items-center justify-center">
                    <Download className="h-8 w-8 sm:h-10 sm:w-10 text-background" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold">Receive Files</h2>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Enter code or scan QR to download files instantly and securely
                  </p>
                  <Button size="lg" className="w-full">
                    Start Receiving
                  </Button>
                </div>
              </Card>
            </div>

            {/* How It Works */}
            <Card className="mt-8 sm:mt-12 p-8 sm:p-10 border-2">
              <h3 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-10">How It Works</h3>
              <div className="grid sm:grid-cols-3 gap-8 sm:gap-10">
                <div className="relative">
                  <div className="text-center space-y-4">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-blue-500 dark:bg-blue-600 blur-xl opacity-20 rounded-full"></div>
                      <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto font-bold text-2xl sm:text-3xl text-white shadow-lg">
                        1
                      </div>
                    </div>
                    <h4 className="font-bold text-lg sm:text-xl">Upload & Share</h4>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      Choose your file and instantly get a unique 6-digit code, QR code, and shareable link
                    </p>
                    <div className="flex justify-center gap-2 pt-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-xs text-muted-foreground">Instant setup</span>
                    </div>
                  </div>
                  {/* Connector line */}
                  <div className="hidden sm:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                </div>
                <div className="relative">
                  <div className="text-center space-y-4">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-purple-500 dark:bg-purple-600 blur-xl opacity-20 rounded-full"></div>
                      <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto font-bold text-2xl sm:text-3xl text-white shadow-lg">
                        2
                      </div>
                    </div>
                    <h4 className="font-bold text-lg sm:text-xl">Connect</h4>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      Receiver enters code, scans QR, or opens link to establish secure P2P connection
                    </p>
                    <div className="flex justify-center gap-2 pt-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-xs text-muted-foreground">Encrypted</span>
                    </div>
                  </div>
                  {/* Connector line */}
                  <div className="hidden sm:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-purple-500 to-green-500"></div>
                </div>
                <div className="text-center space-y-4">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-green-500 dark:bg-green-600 blur-xl opacity-20 rounded-full"></div>
                    <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto font-bold text-2xl sm:text-3xl text-white shadow-lg">
                      3
                    </div>
                  </div>
                  <h4 className="font-bold text-lg sm:text-xl">Transfer</h4>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Files transfer directly browser-to-browser at maximum speed with real-time progress
                  </p>
                  <div className="flex justify-center gap-2 pt-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-xs text-muted-foreground">Lightning fast</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* FAQ Section */}
            <Card className="mt-8 sm:mt-12 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2">
              <h3 className="text-2xl sm:text-3xl font-bold text-center mb-8">Frequently Asked Questions</h3>
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Is it really free?</h4>
                      <p className="text-sm text-muted-foreground">Yes! Quick Share is 100% free with no hidden costs, subscriptions, or file size limits.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">How secure is it?</h4>
                      <p className="text-sm text-muted-foreground">Files are encrypted end-to-end and transfer directly between devices. We never store or access your files.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Do I need to create an account?</h4>
                      <p className="text-sm text-muted-foreground">No registration required! Just open the page and start sharing files immediately.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">What file types are supported?</h4>
                      <p className="text-sm text-muted-foreground">All file types! Documents, images, videos, archives - share anything you need.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">How long do links stay active?</h4>
                      <p className="text-sm text-muted-foreground">Links are active as long as the sender's browser tab remains open. Close the tab to end the session.</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Can I share with multiple people?</h4>
                      <p className="text-sm text-muted-foreground">Currently, one receiver per transfer session. For multiple recipients, send to each individually.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}

        {mode === "send" && <FileSender onBack={reset} />}
        {mode === "receive" && <FileReceiver onBack={reset} initialRoomCode={roomCodeFromUrl} />}

        <footer className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t">
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground px-4">
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3 sm:h-4 sm:w-4" /> Secure
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1">
                <Infinity className="h-3 w-3 sm:h-4 sm:w-4" /> No Limits
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3 sm:h-4 sm:w-4" /> Private
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground px-4">
              Powered by WebRTC • Files transfer directly between browsers
            </p>
            <p className="text-xs text-muted-foreground">
              © 2025 Quick Share. Built with Next.js & WebRTC
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
