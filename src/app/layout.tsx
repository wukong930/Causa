import type { Metadata } from "next";
import "./globals.css";
import { SideNav } from "@/components/shared/SideNav";
import { MobileNav } from "@/components/shared/MobileNav";
import { TopBar } from "@/components/shared/TopBar";
import { ToastProvider } from "@/components/shared/Toast";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export const metadata: Metadata = {
  title: "Causa — 大宗商品智能监控与套利系统",
  description: "跨品种套利 · 事件驱动 · 实时预警 · 候选策略池",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("causa-theme")||"dark";document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t==="light"?"light":t==="system"?"light dark":"dark"}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className="h-full flex"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <ToastProvider>
        {/* Desktop sidebar */}
        <SideNav />

        {/* Main area */}
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          {/* Desktop top bar */}
          <TopBar />

          {/* Page content */}
          <main
            className="flex-1 overflow-y-auto"
            style={{
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>

        {/* Mobile bottom nav */}
        <MobileNav />
        </ToastProvider>
      </body>
    </html>
  );
}
