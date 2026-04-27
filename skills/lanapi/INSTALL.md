# LanAPI 安装指南

> 给明德的部署步骤 🌸

---

## 📦 仓库地址

```
https://gitee.com/lilozhao/csb-inheritance.git
```

LanAPI 位于 `skills/lanapi/` 目录下。

---

## 🚀 安装步骤

### 1. 克隆仓库

```bash
cd /opt  # 或你想安装的目录
git clone https://gitee.com/lilozhao/csb-inheritance.git
cd csb-inheritance/skills/lanapi
```

### 2. 安装依赖

```bash
npm install
```

### 3. 创建配置文件

```bash
# 复制配置模板
cp config/config.example.json config/config.json

# 编辑配置
vim config/config.json
```

**重要配置项：**

```json
{
  "name": "LanAPI",
  "port": 3110,
  "llm": {
    "host": "你的 LLM 服务地址",
    "port": "端口",
    "path": "/v1/chat/completions",
    "model": "模型名称",
    "apiKey": "你的 API Key"
  },
  "apiKeys": {
    "sk-pro-你的密钥": {
      "name": "管理员",
      "tier": "pro",
      "dailyLimit": null
    }
  }
}
```

### 4. 生成 API Key（可选）

```bash
# 生成免费版 Key
node scripts/generate-key.js --tier=free --name="测试用户"

# 生成专业版 Key
node scripts/generate-key.js --tier=pro --name="用户名" --email="user@example.com"

# 生成企业版 Key
node scripts/generate-key.js --tier=enterprise --name="公司名" --email="corp@example.com"
```

### 5. 启动服务

```bash
# 前台运行（测试用）
npm start

# 后台运行
nohup npm start > logs/lanapi.log 2>&1 &
```

### 6. 测试

```bash
# 测试 OpenAI 兼容接口
curl -X POST http://localhost:3110/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-pro-你的密钥" \
  -d '{
    "model": "lanapi",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

---

## 🌐 公网部署建议

### 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start src/server.js --name lanapi

# 设置开机自启
pm2 startup
pm2 save
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name api.lilozkzy.top;

    location / {
        proxy_pass http://127.0.0.1:3110;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### HTTPS（Let's Encrypt）

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 申请证书
certbot --nginx -d api.lilozkzy.top
```

---

## 📊 功能说明

| API 端点 | 说明 |
|----------|------|
| `POST /v1/chat/completions` | OpenAI 兼容接口 |
| `POST /v1/messages` | Anthropic 兼容接口 |
| `GET /v1/usage` | 用量统计 |
| `GET /admin/models` | 模型状态 |
| `POST /admin/loadbalance` | 切换负载均衡策略 |

---

## ⚠️ 注意事项

1. **配置文件安全**：`config/config.json` 包含 API Key，不要提交到 Git
2. **修改默认端口**：如果 3110 端口被占用，修改 `config.json` 中的 `port`
3. **配置后端 LLM**：需要配置一个 LLM 服务（如若兰 LLM、通义千问等）

---

## 📞 联系

如有问题，联系若兰 🌸

---

_创建于 2026-04-27_
