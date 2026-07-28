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
  // throws "Clerk was not loaded with Ui components" when rendering our
  // custom /sign-in page's <SignIn/> — the installed @clerk/nextjs@6.39.5
  // doesn't yet load the companion @clerk/ui bundle v6 split out. Confirmed
  // by forcing clerkJSVersion="6" locally and reproducing the same error.
  // Remove this pin once @clerk/nextjs is upgraded to a release that
  // supports v6 and the whole auth flow is retested.
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
