import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DataProvider } from "@/context/DataContext";
import { ThemeProvider, themeNoFlashScript } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "BizTrack | Business Management",
  description: "Business management app for e-commerce, wholesale, purchases and bank tracking",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BizTrack",
  },
  openGraph: {
    title: "BizTrack | Business Management Suite",
    description: "All-in-one business management app for e-commerce, wholesale, inventory, and bank tracking.",
    siteName: "BizTrack",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 675,
        alt: "BizTrack: Ultimate Business Management Suite",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BizTrack | Business Management Suite",
    description: "All-in-one business management app for e-commerce, wholesale, inventory, and bank tracking.",
    images: ["/og-image.jpg"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Default to dark. The inline script below reconciles with any stored
    // preference before hydration; suppressHydrationWarning avoids a mismatch
    // warning for the class it may toggle.
    <html lang="en" className={`${inter.variable} h-full antialiased dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--color-gray-50)] text-[var(--color-gray-900)]" suppressHydrationWarning>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <AuthGate>
                <DataProvider>
                  <AppShell>
                    {children}
                  </AppShell>
                </DataProvider>
              </AuthGate>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
