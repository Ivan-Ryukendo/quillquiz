import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Markdown Quiz Test",
  description: "Upload markdown files and take interactive quizzes with AI grading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <nav className="border-b border-gray-200 dark:border-gray-800 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-6">
            <Link href="/" className="font-bold text-lg">
              QuizMD
            </Link>
            <Link href="/library" className="text-sm hover:underline">
              Library
            </Link>
            <Link href="/settings" className="text-sm hover:underline ml-auto">
              Settings
            </Link>
          </div>
        </nav>
        <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
