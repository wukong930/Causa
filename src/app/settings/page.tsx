"use client";

import { useState, useEffect } from "react";
import { loadNotificationConfig, updateNotificationConfig, type NotificationConfig } from "@/lib/notifications";
import { useToast } from "@/components/shared/Toast";

interface RiskParameters {
  maxPositionSizePerCommodity: number;
  maxMarginUtilization: number;
  maxConcentrationPerCategory: number;
}

const DEFAULT_RISK_PARAMS: RiskParameters = {
  maxPositionSizePerCommodity: 10,
  maxMarginUtilization: 80,
  maxConcentrationPerCategory: 40,
};

function loadRiskParams(): RiskParameters {
  if (typeof window === "undefined") return DEFAULT_RISK_PARAMS;
  try {
    const raw = localStorage.getItem("causa-risk-params");
    return raw ? { ...DEFAULT_RISK_PARAMS, ...JSON.parse(raw) } : DEFAULT_RISK_PARAMS;
  } catch { return DEFAULT_RISK_PARAMS; }
}

function saveRiskParams(params: RiskParameters) {
  localStorage.setItem("causa-risk-params", JSON.stringify(params));
}

type ThemeMode = "dark" | "light" | "system";

function loadTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("causa-theme") as ThemeMode) || "dark";
}

function applyTheme(mode: ThemeMode) {
  localStorage.setItem("causa-theme", mode);
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode === "light" ? "light" : mode === "system" ? "light dark" : "dark";
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<NotificationConfig>({ webhookUrl: "", enabled: false });
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [saved, setSaved] = useState(false);
  const [riskParams, setRiskParams] = useState<RiskParameters>(DEFAULT_RISK_PARAMS);
  const [riskSaved, setRiskSaved] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const loaded = loadNotificationConfig();
    setConfig(loaded);
    setRiskParams(loadRiskParams());
    setTheme(loadTheme());
  }, []);

  function handleSave() {
    updateNotificationConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTest() {
    if (!config.webhookUrl) {
      alert("请先配置 Webhook URL");
      return;
    }

    setTestStatus("sending");

    try {
      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msg_type: "text",
          content: { text: "【Causa 测试通知】\n飞书 Webhook 配置成功！" },
        }),
      });

      if (response.ok) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
      }
    } catch {
      setTestStatus("error");
    }

    setTimeout(() => setTestStatus("idle"), 3000);
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--foreground)" }}>
        设置
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--foreground-muted)" }}>
        配置通知偏好与系统参数
      </p>

      {/* Feishu Notifications */}
      <section
        className="rounded-lg p-5 mb-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          飞书通知
        </h2>

        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                启用通知
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
                推荐创建、预警触发时发送飞书消息
              </div>
            </div>
            <button
              onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{
                background: config.enabled ? "var(--positive)" : "var(--surface-overlay)",
              }}
            >
              <span
                className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                style={{
                  transform: config.enabled ? "translateX(1.5rem)" : "translateX(0.25rem)",
                }}
              />
            </button>
          </div>

          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground)" }}>
              Webhook URL
            </label>
            <input
              type="url"
              value={config.webhookUrl}
              onChange={(e) => setConfig((prev) => ({ ...prev, webhookUrl: e.target.value }))}
              placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
              className="w-full px-3 py-2 rounded-lg text-sm font-mono"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
            <p className="text-xs mt-1.5" style={{ color: "var(--foreground-subtle)" }}>
              在飞书群聊中添加「自定义机器人」，复制 Webhook 地址粘贴到此处
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: saved ? "var(--positive)" : "var(--accent-blue)",
                color: "#fff",
              }}
            >
              {saved ? "✓ 已保存" : "保存配置"}
            </button>
            <button
              onClick={handleTest}
              disabled={testStatus === "sending"}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background:
                  testStatus === "success"
                    ? "var(--positive)"
                    : testStatus === "error"
                    ? "var(--negative)"
                    : "var(--surface-overlay)",
                color:
                  testStatus === "success" || testStatus === "error"
                    ? "#fff"
                    : "var(--foreground-muted)",
                border: "1px solid var(--border)",
                opacity: testStatus === "sending" ? 0.6 : 1,
              }}
            >
              {testStatus === "sending"
                ? "发送中..."
                : testStatus === "success"
                ? "✓ 测试成功"
                : testStatus === "error"
                ? "✗ 测试失败"
                : "发送测试消息"}
            </button>
          </div>
        </div>
      </section>

      {/* Risk Parameters */}
      <section
        className="rounded-lg p-5 mb-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          风险参数
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--foreground-muted)" }}>
              单品种最大仓位（手）
            </label>
            <input
              type="number"
              value={riskParams.maxPositionSizePerCommodity}
              onChange={(e) => setRiskParams((p) => ({ ...p, maxPositionSizePerCommodity: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--foreground-muted)" }}>
              保证金利用率上限（%）
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={riskParams.maxMarginUtilization}
              onChange={(e) => setRiskParams((p) => ({ ...p, maxMarginUtilization: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--foreground-muted)" }}>
              单板块集中度上限（%）
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={riskParams.maxConcentrationPerCategory}
              onChange={(e) => setRiskParams((p) => ({ ...p, maxConcentrationPerCategory: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { saveRiskParams(riskParams); setRiskSaved(true); setTimeout(() => setRiskSaved(false), 2000); toast("风险参数已保存", "success"); }}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--accent-blue)", color: "#fff" }}
            >
              {riskSaved ? "已保存" : "保存参数"}
            </button>
            <button
              onClick={() => { setRiskParams(DEFAULT_RISK_PARAMS); saveRiskParams(DEFAULT_RISK_PARAMS); }}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface-overlay)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
            >
              恢复默认
            </button>
          </div>
        </div>
      </section>

      {/* Theme */}
      <section
        className="rounded-lg p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          外观
        </h2>
        <div className="flex gap-2">
          {([
            { value: "dark" as ThemeMode, label: "暗色" },
            { value: "light" as ThemeMode, label: "亮色" },
            { value: "system" as ThemeMode, label: "跟随系统" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setTheme(opt.value); applyTheme(opt.value); }}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: theme === opt.value ? "var(--accent-blue)" : "var(--surface-overlay)",
                color: theme === opt.value ? "#fff" : "var(--foreground-muted)",
                border: `1px solid ${theme === opt.value ? "var(--accent-blue)" : "var(--border)"}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
