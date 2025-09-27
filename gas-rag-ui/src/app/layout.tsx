import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { cookies, headers } from "next/headers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GAS-RAG Documentation Assistant",
  description: "High-performance Google Apps Script documentation search with AI-powered synthesis",
  keywords: ["Google Apps Script", "documentation", "RAG", "AI", "search"],
  authors: [{ name: "GAS-RAG Team" }],
  openGraph: {
    title: "GAS-RAG Documentation Assistant",
    description: "Search Google Apps Script documentation with <15ms vector search",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Next.js 15 requires await for cookies and headers
  const cookieStore = await cookies();
  const headersList = await headers();

  // Get theme preference from cookies
  const theme = cookieStore.get("theme")?.value || "light";

  // Get user agent for adaptive features
  const userAgent = headersList.get("user-agent") || "";
  const isMobile = /mobile/i.test(userAgent);

  return (
    <html lang="en" data-theme={theme}>
      <body className={`${inter.className} antialiased min-h-screen bg-background`}>
        <Providers>
          <div className="flex flex-col min-h-screen">
            <header className="border-b border-gray-200 dark:border-gray-800">
              <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    GAS-RAG Assistant
                  </h1>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {isMobile ? "Mobile" : "Desktop"} View
                    </span>
                    <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                      &lt;15ms Search
                    </span>
                  </div>
                </div>
              </div>
            </header>
            <main className="flex-1 container mx-auto px-4 py-8">
              {children}
            </main>
            <footer className="border-t border-gray-200 dark:border-gray-800">
              <div className="container mx-auto px-4 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                Powered by Supabase pgvector • Gemini 2.5 Flash • {new Date().getFullYear()}
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}