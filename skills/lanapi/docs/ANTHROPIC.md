# Anthropic 兼容 API 使用指南

LanAPI 提供完全兼容 Anthropic 的 API 接口，让你可以无缝迁移现有应用。

---

## 🚀 快速开始

### 基础请求

```bash
curl -X POST http://localhost:3110/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-pro-xxx" \
  -d '{
    "model": "claude-3-lanapi",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

### 响应格式

```json
{
  "id": "msg_1777196078944",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "你好呀，我是若兰..."
    }
  ],
  "model": "claude-3-lanapi",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 50
  }
}
```

---

## 📝 参数说明

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | 否 | 模型名称，默认 `claude-3-lanapi` |
| `messages` | array | 是 | 对话消息数组 |
| `max_tokens` | integer | 否 | 最大生成 tokens，默认 1024 |
| `system` | string | 否 | 系统提示词 |
| `stream` | boolean | 否 | 是否流式响应 |

### 消息格式

#### 简单格式

```json
{
  "role": "user",
  "content": "你好"
}
```

#### 复杂格式

```json
{
  "role": "user",
  "content": [
    {"type": "text", "text": "你好"}
  ]
}
```

---

## 💻 代码示例

### Python (Anthropic SDK)

```python
from anthropic import Anthropic

client = Anthropic(
    api_key="sk-pro-xxx",
    base_url="http://localhost:3110"
)

message = client.messages.create(
    model="claude-3-lanapi",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "你好"}
    ]
)

print(message.content[0].text)
```

### JavaScript (fetch)

```javascript
const response = await fetch('http://localhost:3110/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-pro-xxx'
  },
  body: JSON.stringify({
    model: 'claude-3-lanapi',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: '你好' }
    ]
  })
});

const data = await response.json();
console.log(data.content[0].text);
```

### 流式响应

```javascript
const response = await fetch('http://localhost:3110/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer sk-pro-xxx'
  },
  body: JSON.stringify({
    model: 'claude-3-lanapi',
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: 'user', content: '你好' }
    ]
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  console.log(text); // SSE 事件
}
```

---

## 🔄 格式转换

LanAPI 自动将 Anthropic 格式转换为 OpenAI 格式调用底层 LLM，再将响应转换回 Anthropic 格式。

```
Anthropic 请求
      ↓
格式转换 (Anthropic → OpenAI)
      ↓
调用 LLM
      ↓
格式转换 (OpenAI → Anthropic)
      ↓
Anthropic 响应
```

---

## 📊 兼容性

| Anthropic 特性 | LanAPI 支持 |
|---------------|------------|
| Messages API | ✅ |
| System Prompt | ✅ |
| 流式响应 | ✅ |
| Vision (图片) | 🔜 |
| Tools (工具调用) | 🔜 |

---

_创建于 2026-04-26 🌸_
