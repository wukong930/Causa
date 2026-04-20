# Causa — 商品期货套利预警系统

面向专业交易团队的商品期货分析平台，覆盖国内四大交易所及海外主要品种。系统自动监控 50+ 品种的价差、基差、动量等多维信号，通过统计检验与集成学习生成高质量预警，辅助套利决策。

## 核心能力

- **多维预警引擎** — 6 类检测器（价差异常、基差偏移、动量信号、事件驱动、库存冲击、结构转变）经集成聚合，支持自适应阈值与历史命中率加权
- **套利推荐** — 基于协整检验、OU 半衰期、Hurst 指数等统计方法，自动生成跨品种/跨期套利建议，含止损止盈与保证金估算
- **持仓感知** — 预警与推荐考虑当前持仓集中度、保证金使用率，避免重复暴露
- **回测验证** — vectorbt 引擎 + DoWhy 因果推断，支持滚动前推验证与成本模型
- **风控层** — VaR/CVaR（Cornish-Fisher 展开）、相关性矩阵、压力测试（含历史极端日提取）
- **信号反馈闭环** — 自动评估历史预警命中率，动态调整检测器权重

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│  Next.js 16 (App Router)                            │
│  ├── 前端 UI（React 19 + Tailwind v4）              │
│  ├── API Routes（预警/推荐/持仓/风控）              │
│  ├── 调度器（node-cron，8 个定时任务）              │
│  └── LLM 推理层（OpenAI / Anthropic / DeepSeek）    │
├─────────────────────────────────────────────────────┤
│  Python Backtest Service (FastAPI)                   │
│  ├── AkShare 数据接入（国内主力 + 海外期货）        │
│  ├── vectorbt 回测引擎                              │
│  ├── DoWhy 因果验证                                 │
│  └── 产业数据（库存/现货/基差）                     │
├─────────────────────────────────────────────────────┤
│  PostgreSQL 16  │  Weaviate 1.28（向量存储）        │
└─────────────────────────────────────────────────────┘
```

## 品种覆盖

| 板块 | 品种 |
|------|------|
| 黑色 | 螺纹钢 RB、热卷 HC、不锈钢 SS、铁矿石 I、焦炭 J、焦煤 JM、硅铁 SF、锰硅 SM |
| 有色 | 铜 CU、铝 AL、锌 ZN、镍 NI、锡 SN、铅 PB、国际铜 BC |
| 贵金属 | 黄金 AU、白银 AG、铂 PT、钯 PD |
| 能化 | 原油 SC、燃料油 FU、低硫燃油 LU、沥青 BU、PP、PTA、乙二醇 MEG、甲醇 MA、苯乙烯 EB、液化气 PG、纯碱 SA、尿素 UR、PVC、塑料 L |
| 农产品 | 棕榈油 P、豆油 Y、豆粕 M、菜油 OI、菜粕 RM、棉花 CF、白糖 SR、苹果 AP、玉米 C、淀粉 CS、豆一 A、鸡蛋 JD、生猪 LH、纸浆 SP、花生 PK |
| 海外 | WTI 原油 CL、布伦特原油 OIL、咖啡 KC |

<!-- PLACEHOLDER_DEPLOY -->

## 快速部署

### 方式一：Docker Compose（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/wukong930/Causa.git && cd Causa

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，至少填写一个 LLM API Key

# 3. 启动全部服务（Postgres + Weaviate + Backtest + App）
docker compose up -d

# 4. 运行数据库迁移
docker compose exec app npx drizzle-kit migrate

# 5. 访问
# 应用: http://localhost:3000
# 回测服务: http://localhost:8100/health
# 健康检查: http://localhost:3000/api/health?detail=true
```

### 方式二：本地开发

```bash
# 前置条件: Node.js >= 20, pnpm, Python 3.11+, PostgreSQL, Weaviate

# 1. 安装依赖
pnpm install

# 2. 启动基础设施（或用 Docker 只跑 Postgres + Weaviate）
docker compose up -d postgres weaviate

# 3. 配置环境变量
cp .env.example .env

# 4. 数据库迁移
pnpm db:migrate

# 5. 启动 Python 回测服务
cd services/backtest
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8100 &
cd ../..

# 6. 启动开发服务器
pnpm dev
```

### 方式三：Vercel + 外部服务

适合前端部署到 Vercel，数据库和回测服务部署在其他地方：

1. Vercel 导入仓库，设置环境变量（参考 `.env.example`）
2. PostgreSQL 使用 Neon / Supabase / 自建
3. Weaviate 使用 Weaviate Cloud 或自建
4. Python 回测服务部署到 Railway / Fly.io / 自建 VPS

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `API_SECRET` | 生产必填 | API Bearer Token，空值跳过认证（仅开发） |
| `CRON_SECRET` | 生产必填 | 定时任务认证 |
| `OPENAI_API_KEY` | 至少一个 | LLM 推理（OpenAI） |
| `ANTHROPIC_API_KEY` | 至少一个 | LLM 推理（Anthropic） |
| `DEEPSEEK_API_KEY` | 至少一个 | LLM 推理（DeepSeek） |
| `LLM_ENCRYPTION_KEY` | 推荐 | API Key 加密密钥（`openssl rand -hex 32`） |
| `BACKTEST_SERVICE_URL` | 是 | Python 回测服务地址 |
| `WEAVIATE_URL` | 是 | Weaviate 向量数据库地址 |
| `FRED_API_KEY` | 否 | 宏观经济数据（FRED） |

## 定时任务

系统内置 8 个定时任务，由 `node-cron` 调度：

| 任务 | 频率 | 说明 |
|------|------|------|
| 行情数据 | 交易日 10:05/11:05/14:05/15:05 | 从 AkShare 拉取最新行情 |
| 预警触发 | 每小时 | 运行 6 类检测器 + 集成聚合 |
| 上下文刷新 | 每 4 小时 | 更新宏观/GDELT 事件上下文 |
| 假设演化 | 每日 08:00 | 更新研究假设状态 |
| 风险计算 | 每日 08:30 | VaR/相关性/压力测试 |
| 信号评判 | 每日 09:00 | 自动评估历史预警命中率 |
| 绩效追踪 | 交易日 16:30 | 持仓盈亏追踪 |
| 数据清理 | 每周日 03:00 | 清理过期数据 |

## 项目结构

```
causa/
├── src/
│   ├── app/                  # Next.js App Router 页面 + API
│   │   ├── api/              # REST API（alerts, recommendations, positions...）
│   │   ├── dashboard/        # 总览页
│   │   ├── alerts/           # 预警页
│   │   └── ...
│   ├── lib/
│   │   ├── trigger/          # 6 类预警检测器 + 集成 + 自适应阈值
│   │   ├── risk/             # VaR, 相关性, 压力测试
│   │   ├── pipeline/         # 推荐生成编排器
│   │   ├── stats/            # 协整检验, OU 过程, Hurst 指数
│   │   ├── memory/           # Weaviate 向量存储（regime, hypothesis）
│   │   ├── scheduler/        # 定时任务管理
│   │   └── data-sources/     # 行情数据接入
│   ├── db/                   # Drizzle ORM schema + 连接
│   └── types/                # TypeScript 类型定义
├── services/backtest/        # Python 回测微服务
│   ├── main.py               # FastAPI 入口
│   ├── akshare_ingest.py     # AkShare 数据接入
│   ├── backtest.py           # vectorbt 回测引擎
│   ├── causal.py             # DoWhy 因果推断
│   ├── cost_model.py         # 全品种交易成本模型
│   └── industry_data.py      # 库存/现货/基差数据
├── drizzle/                  # 数据库迁移文件
├── docker-compose.yml        # 一键部署（4 个服务）
├── Dockerfile                # Next.js 多阶段构建
└── .env.example              # 环境变量模板
```

## 健康检查

```bash
# 基础状态
curl http://localhost:3000/api/health

# 完整诊断（数据库/调度器/数据新鲜度/Weaviate）
curl http://localhost:3000/api/health?detail=true
```

## License

Private — All rights reserved.
