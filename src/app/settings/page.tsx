"use client";

import { useState, useEffect, useCallback } from "react";
import { loadNotificationConfig, updateNotificationConfig, type NotificationConfig } from "@/lib/notifications";
import { useToast } from "@/components/shared/Toast";
import type { LLMProviderName } from "@/lib/llm/types";
import { DEFAULT_MODELS } from "@/lib/llm/types";

interface ScheduledJob {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  running: boolean;
  lastRun?: string;
  lastResult?: 'success' | 'error';
  lastError?: string;
}

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

  // LLM config state
  const [llmProvider, setLlmProvider] = useState<LLMProviderName>("openai");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmModel, setLlmModel] = useState("gpt-4o");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [llmConfigId, setLlmConfigId] = useState<string | null>(null);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmTestStatus, setLlmTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [llmTestMsg, setLlmTestMsg] = useState("");

  // Scheduler state
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [editingCron, setEditingCron] = useState<Record<string, string>>({});
  const [customCronMode, setCustomCronMode] = useState<Record<string, boolean>>({});
  const [runningAction, setRunningAction] = useState<string | null>(null);

  // Account state
  const [accountNetValue, setAccountNetValue] = useState<string>("10000000");
  const [accountSaving, setAccountSaving] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduler");
      if (res.ok) { const data = await res.json(); setJobs(data.data?.jobs || data.jobs || []); }
    } catch {}
  }, []);

  async function schedulerAction(action: string, jobId?: string, cron?: string) {
    setRunningAction(jobId ? `${action}-${jobId}` : action);
    try {
      await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, jobId, cron }),
      });
      await fetchJobs();
    } catch {}
    setRunningAction(null);
  }

  useEffect(() => {
    const loaded = loadNotificationConfig();
    setConfig(loaded);
    setRiskParams(loadRiskParams());
    setTheme(loadTheme());
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    // Load LLM config
    fetch("/api/llm/config")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data.configs.length > 0) {
          const cfg = res.data.configs[0];
          setLlmProvider(cfg.provider as LLMProviderName);
          setLlmModel(cfg.model);
          setLlmBaseUrl(cfg.baseUrl || "");
          setLlmConfigId(cfg.id);
          setLlmApiKey(""); // Don't load key back for security
        }
      })
      .catch(() => {});
    // Load account snapshot
    fetch("/api/account/snapshot")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.netValue) {
          setAccountNetValue(String(res.data.netValue));
        }
      })
      .catch(() => {});
    return () => clearInterval(interval);
  }, [fetchJobs]);

  async function handleLlmSave() {
    if (!llmApiKey && !llmConfigId) {
      toast("请输入 API Key", "error");
      return;
    }
    setLlmSaving(true);
    try {
      const body: Record<string, unknown> = { provider: llmProvider, apiKey: llmApiKey, model: llmModel, enabled: true };
      if (llmBaseUrl) body.baseUrl = llmBaseUrl;
      if (llmConfigId) body.id = llmConfigId;
      const res = await fetch("/api/llm/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        setLlmConfigId(data.data.id);
        toast("AI 模型配置已保存", "success");
      } else {
        toast(data.error?.message || "保存失败", "error");
      }
    } catch { toast("保存失败", "error"); }
    setLlmSaving(false);
  }

  async function handleLlmTest() {
    if (!llmApiKey) { toast("请输入 API Key", "error"); return; }
    setLlmTestStatus("testing");
    setLlmTestMsg("");
    try {
      const body: Record<string, unknown> = { provider: llmProvider, apiKey: llmApiKey, model: llmModel };
      if (llmBaseUrl) body.baseUrl = llmBaseUrl;
      const res = await fetch("/api/llm/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        setLlmTestStatus("success");
        setLlmTestMsg(`模型: ${data.data.model}`);
      } else {
        setLlmTestStatus("error");
        setLlmTestMsg(data.error?.message || "连接失败");
      }
    } catch {
      setLlmTestStatus("error");
      setLlmTestMsg("网络错误");
    }
    setTimeout(() => setLlmTestStatus("idle"), 4000);
  }

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

      {/* Scheduler */}
      <section className="rounded-lg p-5 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>定时任务</h2>
          <div className="flex gap-2">
            <button onClick={() => schedulerAction("startAll")} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: "var(--positive)", color: "#fff" }}>全部启动</button>
            <button onClick={() => schedulerAction("stopAll")} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: "var(--surface-overlay)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}>全部停止</button>
          </div>
        </div>
        <div className="space-y-3">
          {jobs.map((job) => {
            const CRON_PRESETS = [
              { label: "每小时", value: "0 * * * *" },
              { label: "每2小时", value: "0 */2 * * *" },
              { label: "每4小时", value: "0 */4 * * *" },
              { label: "每天 8:00", value: "0 8 * * *" },
              { label: "每天 8:30", value: "30 8 * * *" },
              { label: "每天 15:00", value: "0 15 * * *" },
              { label: "工作日 8:00", value: "0 8 * * 1-5" },
              { label: "工作日 15:00", value: "0 15 * * 1-5" },
              { label: "每周日 3:00", value: "0 3 * * 0" },
            ];
            const currentCron = editingCron[job.id] ?? job.cron;
            const isPreset = CRON_PRESETS.some((p) => p.value === currentCron) && !customCronMode[job.id];
            const presetLabel = CRON_PRESETS.find((p) => p.value === currentCron)?.label;

            return (
              <div key={job.id} className="rounded-lg p-3" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => schedulerAction(job.enabled ? "stop" : "start", job.id)}
                    className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
                    style={{ background: job.enabled ? "var(--positive)" : "var(--surface-overlay)" }}
                  >
                    <span className="inline-block h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: job.enabled ? "translateX(1.5rem)" : "translateX(0.25rem)" }} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{job.name}</span>
                      {job.running && <span className="inline-block h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--accent-blue)" }} />}
                      {job.lastRun && (
                        <span className="text-xs" style={{ color: job.lastResult === "error" ? "var(--negative)" : "var(--foreground-subtle)" }}>
                          {new Date(job.lastRun).toLocaleTimeString()} {job.lastResult === "error" ? "失败" : "成功"}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => schedulerAction("run", job.id)}
                    disabled={job.running || runningAction === `run-${job.id}`}
                    className="px-3 py-1.5 rounded text-xs font-medium shrink-0"
                    style={{ background: "var(--accent-blue)", color: "#fff", opacity: job.running ? 0.5 : 1 }}
                  >
                    {job.running ? "运行中..." : "立即执行"}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 ml-14">
                  <select
                    className="px-2 py-1 rounded text-xs"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
                    value={isPreset ? currentCron : "__custom__"}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__custom__") {
                        setCustomCronMode((p) => ({ ...p, [job.id]: true }));
                        setEditingCron((p) => ({ ...p, [job.id]: job.cron }));
                        return;
                      }
                      setCustomCronMode((p) => ({ ...p, [job.id]: false }));
                      setEditingCron((p) => ({ ...p, [job.id]: v }));
                      schedulerAction("updateCron", job.id, v);
                    }}
                  >
                    {CRON_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                    <option value="__custom__">自定义...</option>
                  </select>
                  {!isPreset && (
                    <input
                      className="px-2 py-1 rounded text-xs font-mono w-36"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
                      value={currentCron}
                      placeholder="分 时 日 月 周"
                      onChange={(e) => setEditingCron((p) => ({ ...p, [job.id]: e.target.value }))}
                      onBlur={() => { if (editingCron[job.id] && editingCron[job.id] !== job.cron) schedulerAction("updateCron", job.id, editingCron[job.id]); }}
                    />
                  )}
                  {isPreset && (
                    <span className="text-xs font-mono" style={{ color: "var(--foreground-subtle)" }}>
                      {presetLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {jobs.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: "var(--foreground-subtle)" }}>调度器未启动（仅在 Docker/生产环境中运行）</p>
          )}
        </div>
      </section>

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

      {/* Account Settings */}
      <section
        className="rounded-lg p-5 mb-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          账户设置
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>
              账户初始资金（元）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="flex-1 px-3 py-2 rounded text-sm"
                style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                value={accountNetValue}
                onChange={(e) => setAccountNetValue(e.target.value)}
                min={0}
                step={100000}
              />
              <button
                disabled={accountSaving}
                className="px-4 py-2 rounded text-sm font-medium"
                style={{ background: "var(--accent-blue)", color: "#fff", opacity: accountSaving ? 0.6 : 1 }}
                onClick={async () => {
                  const val = parseFloat(accountNetValue);
                  if (!val || val <= 0) { toast("请输入有效金额", "error"); return; }
                  setAccountSaving(true);
                  try {
                    const res = await fetch("/api/account/snapshot", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ netValue: val }),
                    });
                    if (res.ok) toast("账户资金已更新", "success");
                    else toast("更新失败", "error");
                  } catch { toast("更新失败", "error"); }
                  setAccountSaving(false);
                }}
              >
                {accountSaving ? "保存中..." : "保存"}
              </button>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
              设置后将用于持仓跟踪的保证金利用率和风险计算
            </p>
          </div>
          <div className="pt-3 mt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <button
              className="px-3 py-1.5 rounded text-xs"
              style={{ background: "var(--surface-overlay)", color: "var(--negative)", border: "1px solid var(--border)" }}
              onClick={async () => {
                if (!confirm("确定要重置账户数据吗？这将清除所有历史快照和持仓记录。")) return;
                try {
                  const res = await fetch("/api/account/snapshot", { method: "DELETE" });
                  if (res.ok) toast("账户数据已重置", "success");
                  else toast("重置失败", "error");
                } catch { toast("重置失败", "error"); }
              }}
            >
              重置模拟数据
            </button>
            <p className="text-xs mt-1" style={{ color: "var(--foreground-subtle)" }}>
              清除所有历史账户快照和持仓记录，下次访问持仓页时将使用新设置的金额
            </p>
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section
        className="rounded-lg p-5 mb-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          数据源
        </h2>
        <div className="space-y-3">
          <div
            className="flex items-center justify-between rounded-lg px-4 py-3"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--positive)" }} />
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>合成数据 (Synthetic)</div>
                <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>内置模拟行情，用于开发测试</div>
              </div>
            </div>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--positive-muted)", color: "var(--positive)" }}>已启用</span>
          </div>
          {["CTP 实时行情", "Wind 金融终端", "Bloomberg", "自定义 API"].map((name) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-lg px-4 py-3 opacity-50"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: "var(--foreground-subtle)" }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{name}</div>
                  <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>即将支持</div>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--surface-overlay)", color: "var(--foreground-subtle)" }}>未接入</span>
            </div>
          ))}
        </div>
      </section>

      {/* AI Model Config */}
      <section
        className="rounded-lg p-5 mb-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>
          AI 模型配置
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--foreground-muted)" }}>Provider</label>
              <select
                value={llmProvider}
                onChange={(e) => {
                  const p = e.target.value as LLMProviderName;
                  setLlmProvider(p);
                  setLlmModel(DEFAULT_MODELS[p][0]);
                }}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="deepseek">DeepSeek</option>
                <option value="xai">xAI (Grok)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "var(--foreground-muted)" }}>模型</label>
              <select
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                {DEFAULT_MODELS[llmProvider].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--foreground-muted)" }}>API Key</label>
            <input
              type="password"
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              placeholder={llmConfigId ? "已配置（留空保持不变）" : "sk-..."}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5" style={{ color: "var(--foreground-muted)" }}>
              Base URL（可选，自定义端点）
            </label>
            <input
              value={llmBaseUrl}
              onChange={(e) => setLlmBaseUrl(e.target.value)}
              placeholder={llmProvider === "openai" ? "https://api.openai.com/v1" : llmProvider === "anthropic" ? "https://api.anthropic.com" : llmProvider === "xai" ? "https://api.x.ai/v1" : "https://api.deepseek.com/v1"}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
          </div>
          {llmTestMsg && (
            <p className="text-xs" style={{ color: llmTestStatus === "success" ? "var(--positive)" : "var(--negative)" }}>
              {llmTestMsg}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleLlmSave}
              disabled={llmSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--accent-blue)", color: "#fff", opacity: llmSaving ? 0.6 : 1 }}
            >
              {llmSaving ? "保存中..." : "保存配置"}
            </button>
            <button
              onClick={handleLlmTest}
              disabled={llmTestStatus === "testing"}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: llmTestStatus === "success" ? "var(--positive)" : llmTestStatus === "error" ? "var(--negative)" : "var(--surface-overlay)",
                color: llmTestStatus === "success" || llmTestStatus === "error" ? "#fff" : "var(--foreground-muted)",
                border: "1px solid var(--border)",
                opacity: llmTestStatus === "testing" ? 0.6 : 1,
              }}
            >
              {llmTestStatus === "testing" ? "测试中..." : llmTestStatus === "success" ? "连接成功" : llmTestStatus === "error" ? "连接失败" : "测试连接"}
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
