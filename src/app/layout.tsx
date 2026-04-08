import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuillQuiz",
  description: "Turn your markdown notes into interactive quizzes with AI grading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ConvexClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <nav className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div className="max-w-5xl mx-auto flex items-center gap-8">
                <Link href="/" className="font-serif font-bold text-2xl tracking-tight">
                  QuillQuiz.
                </Link>
                <Link href="/library" className="text-sm font-medium hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  Library
                </Link>
                <div className="ml-auto flex items-center gap-4">
                  <Link href="/settings" className="text-sm font-medium hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                    Settings
                  </Link>
                  <ThemeToggle />
                </div>
              </div>
            </nav>
            <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
              {children}
            </main>
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
