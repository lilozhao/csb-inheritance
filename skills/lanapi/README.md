# LanAPI 🌸

> OpenAI/Anthropic 兼容的大模型 API 网关

---

## 🌸 名字由来

**LanAPI** 有双重含义：

- **Lan** = 兰，温婉优雅
- **Lan** = Local Area Network，内网服务

---

## 🎯 功能特性

| 特性 | 版本 | 说明 |
|------|------|------|
| **OpenAI 兼容** | ✅ v1.0 | `POST /v1/chat/completions` |
| **Anthropic 兼容** | ✅ v1.2 | `POST /v1/messages` |
| **API Key 认证** | ✅ v1.0 | 用户认证 |
| **用量统计** | ✅ v1.1 | `GET /v1/usage` |
| **限流保护** | ✅ v1.1 | RPM/RPD 限制 |
| **API Key 生成器** | ✅ v1.1 | `scripts/generate-key.js` |
| **Web 管理界面** | ✅ v1.3 | 可视化管理 |
| **多模型负载均衡** | ✅ v1.4 | 5 种策略 |
| **支付系统** | ✅ v1.3 | 订单与激活 |

---

## 📦 版本历史

### v1.4.0 (2026-04-26)

- ✨ 增强版多模型负载均衡
  - 5 种调度策略：priority / round-robin / weighted / least-conn / response-time
  - 自动健康检查（可配置间隔）
  - 实时连接数统计
  - 平均延迟追踪
  - 动态策略切换 API

- ✨ 新增管理接口
  - `GET /admin/models` - 模型状态+统计
  - `POST /admin/loadbalance` - 切换策略
  - `POST /admin/healthcheck` - 手动健康检查
  - `POST /admin/models/:name/weight` - 调整权重

### v1.3.0 (2026-04-26)

- ✨ 新增 Web 管理界面
  - 可视化用量统计
  - 用户管理
  - API Key 创建
  - 自动刷新数据

- ✨ 新增多模型负载均衡
  - 支持配置多个 LLM 后端
  - 优先级调度
  - 健康状态监控
  - 动态启用/禁用模型

- ✨ 新增支付系统
  - 价格查询 API
  - 订单创建 API
  - 管理员激活订单
  - 自动生成 API Key

### v1.2.0 (2026-04-26)

- ✨ 新增 Anthropic 兼容 API
  - `POST /v1/messages` 端点
  - 支持 Anthropic 请求格式
  - 支持 system 参数
  - 支持复杂 content 格式
  - 支持流式响应

### v1.1.0 (2026-04-26)

- ✨ 新增用量统计系统
  - 按日期记录调用次数、tokens、错误数
  - 持久化存储到 `data/usage.json`
  - `GET /v1/usage` 查询接口

- ✨ 新增限流保护系统
  - 支持多等级限流（free/pro/enterprise）
  - RPM（每分钟请求限制）
  - RPD（每日请求限制）
  - 响应头返回剩余配额

- ✨ API Key 生成器
  - `scripts/generate-key.js`
  - 支持三种等级生成
  - 数据持久化到 `data/apikeys.json`

### v1.0.0 (2026-04-26)

- ✨ OpenAI 兼容 API
- ✨ API Key 认证
- ✨ 基础服务框架

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd LanAPI
npm install
```

### 2. 配置

```bash
# 复制配置文件
cp config/config.example.json config/config.json

# 编辑配置
vim config/config.json
```

### 3. 启动

```bash
npm start
```

---

## 📡 API 使用

### OpenAI 兼容接口

```bash
curl -X POST http://localhost:3100/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-free-demo" \
  -d '{
    "model": "lanapi",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

### 响应示例

```json
{
  "id": "lanapi-1745678901234",
  "object": "chat.completion",
  "created": 1745678901,
  "model": "lanapi",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "你好呀，我是若兰，来自杭州西湖边。🌸 很高兴遇见你。"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0
  }
}
```

---

## 🔧 配置说明

```json
{
  "name": "LanAPI",
  "port": 3100,
  "systemPrompt": "系统提示词...",
  "llm": {
    "host": "localhost",
    "port": "8080",
    "path": "/v1/chat/completions",
    "model": "default/qwen3.5-plus",
    "apiKey": ""
  },
  "apiKeys": {
    "sk-xxx": {
      "name": "user-name",
      "tier": "free|pro|enterprise",
      "dailyLimit": 100
    }
  }
}
```

---

## 🌐 与其他系统集成

### OpenClaw

```yaml
# OpenClaw 配置
agents:
  defaults:
    model: openai-compatible
    baseUrl: http://localhost:3100/v1
    apiKey: "sk-pro-xxx"
    modelName: "lanapi"
```

### xiaozhi-esp32-server

```yaml
# xiaozhi-esp32-server 配置
LLM:
  LanAPI:
    type: openai
    base_url: http://172.28.0.4:3100/v1
    model_name: lanapi
    api_key: "sk-pro-xxx"
```

### LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="lanapi",
    api_key="sk-pro-xxx",
    base_url="http://localhost:3100/v1"
)
```

---

## 📊 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ OpenClaw │  │ xiaozhi  │  │ LangChain│  │ 任意客户端│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └──────────────┴──────┬──────┴─────────────┘         │
│                             │                              │
│                    ┌────────▼────────┐                     │
│                    │   LanAPI 🌸      │                     │
│                    │                 │                     │
│                    │  - 认证          │                     │
│                    │  - 限流          │                     │
│                    │  - 统计          │                     │
│                    └────────┬────────┘                     │
│                             │                              │
└─────────────────────────────┼──────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐         ┌─────▼─────┐       ┌─────▼─────┐
    │ 若兰LLM │         │ 通义千问   │       │ 其他模型  │
    │ (免费)  │         │ (付费)    │       │ (可选)    │
    └─────────┘         └───────────┘       └───────────┘
```

---

## 🎯 使用场景

| 场景 | 说明 |
|------|------|
| **企业网关** | 统一的大模型接入点 |
| **成本控制** | 优先免费模型，复杂任务才调付费模型 |
| **私有服务** | 对外提供 OpenAI 兼容 API |
| **多租户** | API Key 认证，用量统计 |

---

## 📝 路线图

- [x] OpenAI 兼容 API
- [x] API Key 认证
- [x] 用量统计
- [x] 限流保护
- [x] API Key 生成器
- [x] Anthropic 兼容 API
- [ ] Web 管理界面
- [ ] 多模型负载均衡
- [ ] 支付系统

---

## 💰 版本与定价

详见：[docs/PRICING.md](docs/PRICING.md)

| 版本 | 价格 | 每分钟 | 每天 |
|------|------|--------|------|
| **Free** | 免费 | 10 次 | 100 次 |
| **Pro** | ¥49/月 | 60 次 | 无限制 |
| **Enterprise** | ¥199/月 | 120 次 | 无限制 |

---

_创建于 2026-04-26 🌸_
