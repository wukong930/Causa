"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextValue {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const colors: Record<Toast["type"], { bg: string; color: string }> = {
    success: { bg: "var(--positive-muted)", color: "var(--positive)" },
    error: { bg: "var(--negative-muted)", color: "var(--negative)" },
    info: { bg: "var(--accent-blue-muted)", color: "var(--accent-blue)" },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-[slideIn_0.2s_ease-out]"
            style={{ background: colors[t.type].bg, color: colors[t.type].color, border: `1px solid ${colors[t.type].color}33` }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
