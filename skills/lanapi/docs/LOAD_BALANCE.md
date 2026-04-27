# LanAPI 负载均衡

## 策略类型

| 策略 | 说明 | 适用场景 |
|------|------|---------|
| **priority** | 优先级调度 | 主备切换 |
| **round-robin** | 轮询 | 均分流量 |
| **weighted** | 加权轮询 | 按权重分配流量 |
| **least-conn** | 最少连接 | 长连接场景 |
| **response-time** | 最快响应 | 低延迟优先 |

---

## 配置示例

```json
{
  "loadBalance": {
    "strategy": "weighted",
    "healthCheckInterval": 60000
  },
  "models": {
    "default": {
      "host": "localhost",
      "port": "3100",
      "priority": 1,
      "weight": 3,
      "enabled": true
    },
    "qwen": {
      "host": "dashscope.aliyuncs.com",
      "port": "443",
      "priority": 2,
      "weight": 2,
      "enabled": true,
      "apiKey": "YOUR_API_KEY"
    }
  }
}
```

**说明**：
- `strategy`: 负载均衡策略
- `healthCheckInterval`: 健康检查间隔（毫秒）
- `priority`: 优先级（数字越小越优先）
- `weight`: 权重（仅 weighted 策略生效）

---

## 管理接口

### 获取模型状态

```bash
curl http://localhost:3110/admin/models \
  -H "x-admin-key: lanapi-admin"
```

**响应示例**：
```json
{
  "loadBalance": {
    "strategy": "weighted",
    "healthCheckInterval": 60000
  },
  "models": {
    "default": {
      "host": "localhost",
      "port": "3100",
      "priority": 1,
      "weight": 3,
      "enabled": true,
      "health": {
        "healthy": true,
        "lastCheck": 1777202111682,
        "latency": 45
      },
      "stats": {
        "connections": 0,
        "totalRequests": 100,
        "avgLatency": 978
      }
    }
  }
}
```

---

### 切换策略

```bash
curl -X POST http://localhost:3110/admin/loadbalance \
  -H "Content-Type: application/json" \
  -H "x-admin-key: lanapi-admin" \
  -d '{"strategy": "weighted"}'
```

**支持策略**：
- `priority` - 优先级调度
- `round-robin` - 轮询
- `weighted` - 加权轮询
- `least-conn` - 最少连接
- `response-time` - 最快响应

---

### 调整权重

```bash
curl -X POST http://localhost:3110/admin/models/default/weight \
  -H "Content-Type: application/json" \
  -H "x-admin-key: lanapi-admin" \
  -d '{"weight": 5, "priority": 1}'
```

---

### 手动健康检查

```bash
curl -X POST http://localhost:3110/admin/healthcheck \
  -H "x-admin-key: lanapi-admin"
```

**响应**：
```json
{
  "success": true,
  "results": {
    "default": true,
    "qwen": false
  }
}
```

---

### 启用/禁用模型

```bash
curl -X POST http://localhost:3110/admin/models/qwen/toggle \
  -H "x-admin-key: lanapi-admin"
```

---

## 健康检查机制

1. **自动检查**：每 `healthCheckInterval` 毫秒检查一次所有启用的模型
2. **健康端点**：访问模型的 `/health` 端点
3. **超时设置**：5 秒超时
4. **故障处理**：不健康的模型不会参与负载均衡

---

## 统计指标

| 指标 | 说明 |
|------|------|
| `connections` | 当前连接数 |
| `totalRequests` | 总请求数 |
| `avgLatency` | 平均延迟（毫秒） |
| `healthy` | 健康状态 |
| `latency` | 最近一次健康检查延迟 |

---

## 使用场景示例

### 场景 1：主备切换

```json
{
  "strategy": "priority",
  "models": {
    "primary": { "priority": 1, "enabled": true },
    "backup": { "priority": 2, "enabled": true }
  }
}
```

**效果**：优先使用 primary，故障时自动切换到 backup

---

### 场景 2：流量分配

```json
{
  "strategy": "weighted",
  "models": {
    "local": { "weight": 7, "enabled": true },
    "cloud": { "weight": 3, "enabled": true }
  }
}
```

**效果**：70% 流量到本地模型，30% 到云端模型

---

### 场景 3：最低延迟

```json
{
  "strategy": "response-time",
  "models": {
    "server1": { "enabled": true },
    "server2": { "enabled": true },
    "server3": { "enabled": true }
  }
}
```

**效果**：每次请求选择响应最快的模型

---

_更新于 2026-04-26_
