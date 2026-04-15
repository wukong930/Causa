"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { NAV_ITEMS } from "@/lib/constants";
import { clsx } from "@/lib/utils";
import { getAlerts } from "@/lib/api-client";

// Simple inline SVG icons
const icons: Record<string, React.ReactNode> = {
  grid: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  bell: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  layers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  "file-text": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  "share-2": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  "check-square": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
    </svg>
  ),
};

export function SideNav() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    getAlerts().then((alerts) => {
      setAlertCount(alerts.filter((a) => a.status === "active").length);
    });
  }, []);

  return (
    <nav
      className="hidden md:flex flex-col w-[220px] shrink-0 border-r"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
          style={{ background: "var(--accent-blue)", color: "#fff" }}
        >
          C
        </div>
        <span className="font-semibold text-sm tracking-wide" style={{ color: "var(--foreground)" }}>
          Causa
        </span>
        <span className="ml-auto text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)" }}>
          1.0
        </span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const isAlert = item.id === "alerts";
          return (
            <Link
              key={item.id}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
                isActive
                  ? "font-medium"
                  : "hover:text-[var(--foreground)]"
              )}
              style={{
                background: isActive ? "var(--surface-overlay)" : "transparent",
                color: isActive ? "var(--foreground)" : "var(--foreground-muted)",
              }}
            >
              <span className="shrink-0">{icons[item.icon]}</span>
              <span>{item.label}</span>
              {isAlert && alertCount > 0 && (
                <span
                  className="ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--alert-critical)", color: "#fff", minWidth: "20px", textAlign: "center" }}
                >
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom status */}
      <div
        className="px-4 py-3 border-t text-xs"
        style={{ borderColor: "var(--border)", color: "var(--foreground-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--positive)" }}
          />
          数据实时同步中
        </div>
      </div>
    </nav>
  );
}
