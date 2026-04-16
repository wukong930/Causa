"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "var(--negative-muted)", color: "var(--negative)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>
              页面出错了
            </h2>
            <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
              {this.state.error?.message || "发生了未知错误"}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: "var(--accent-blue)", color: "#fff" }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
