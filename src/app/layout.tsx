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
  applicationName: "Job Command Center",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "hsl(217 91% 60%)",
          colorBackground: "hsl(var(--card))",
          colorText: "hsl(var(--foreground))",
          colorTextSecondary: "hsl(var(--muted-foreground))",
          colorInputBackground: "hsl(var(--background))",
          colorInputText: "hsl(var(--foreground))",
          colorDanger: "hsl(var(--destructive))",
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-inter), sans-serif",
        },
        elements: {
          card: "bg-card border border-border dark:border-white/10 rounded-2xl shadow-lg",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton:
            "border-border bg-background hover:bg-muted text-foreground dark:bg-white/5 dark:border-white/15 dark:hover:bg-white/10",
          socialButtonsBlockButtonText: "text-foreground",
          dividerLine: "bg-border dark:bg-white/15",
          dividerText: "text-muted-foreground",
          formFieldLabel: "text-foreground",
          formFieldInput:
            "bg-background border-border text-foreground dark:bg-white/5 dark:border-white/15",
          formButtonPrimary: "bg-accent hover:bg-accent-hover text-white",
          footerActionText: "text-muted-foreground",
          footerActionLink: "text-accent hover:text-accent-hover",
          identityPreviewText: "text-foreground",
          identityPreviewEditButton: "text-accent hover:text-accent-hover",
          formResendCodeLink: "text-accent hover:text-accent-hover",
          otpCodeFieldInput:
            "bg-background border-border text-foreground dark:bg-white/5 dark:border-white/15",
          badge: "bg-muted text-muted-foreground dark:bg-white/10",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
