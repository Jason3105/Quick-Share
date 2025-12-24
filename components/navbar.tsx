"use client";

import Link from "next/link";
import { Github } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

export function Navbar() {
  return (
    <nav className="border-b bg-card sticky top-0 z-50">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
            <Logo className="h-8 w-8 sm:h-10 sm:w-10 text-foreground" />
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-foreground">
                Quick Share
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">P2P File Transfer</p>
            </div>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <a 
              href="https://github.com/Jason3105/Quick-Share" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="View source on GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
