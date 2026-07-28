import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Job Command Center",
  description: "AI-powered job search pipeline",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "JobCC",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Pinned: Clerk's CDN now defaults unpinned installs to clerk-js v6, which
  // breaks this app's custom /sign-in page — it redirects to Clerk's hosted
  // Account Portal instead, looping through the dev-browser handshake until
  // Clerk itself 429s. Confirmed by forcing clerkJSVersion="6" locally and
  // reproducing the same failure. Remove this pin only after migrating to
  // and testing against v6.
  return (
    <ClerkProvider clerkJSVersion="5">
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
