import type { Metadata } from "next";
import "./globals.css";
import { SideNav } from "@/components/shared/SideNav";
import { MobileNav } from "@/components/shared/MobileNav";
import { TopBar } from "@/components/shared/TopBar";
import { mockAlerts } from "@/mocks/alerts";

export const metadata: Metadata = {
  title: "Causa — 大宗商品智能监控与套利系统",
  description: "跨品种套利 · 事件驱动 · 实时预警 · 候选策略池",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const activeAlertCount = mockAlerts.filter((a) => a.status === "active").length;

  return (
    <html lang="zh-CN" className="h-full">
      <body
        className="h-full flex"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        {/* Desktop sidebar */}
        <SideNav alertCount={activeAlertCount} />

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
            {children}
          </main>
        </div>

        {/* Mobile bottom nav */}
        <MobileNav alertCount={activeAlertCount} />
      </body>
    </html>
  );
}
