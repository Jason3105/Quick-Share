import type { Metadata } from "next";
import NotFoundClient from "./not-found-client";

export const metadata: Metadata = {
  title: '404 - Page Not Found | Quick Share',
  description: 'The page you are looking for does not exist. Return to Quick Share to send or receive files instantly for free.',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://quicksharep2p.onrender.com' },
};

export default function NotFound() {
  return <NotFoundClient />;
}
