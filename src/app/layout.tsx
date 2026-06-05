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
  title: "BizTrack | SaaS Management",
  description: "Business management SaaS web application",
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
