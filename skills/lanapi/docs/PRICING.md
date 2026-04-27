# LanAPI 版本与定价

## 📊 版本对比

| 特性 | Free | Pro | Enterprise |
|------|------|-----|------------|
| **价格** | 免费 | ¥49/月 | ¥199/月 |
| **每分钟请求** | 10 次 | 60 次 | 120 次 |
| **每日请求** | 100 次 | 无限制 | 无限制 |
| **API Key 前缀** | `sk-free-` | `sk-pro-` | `sk-ent-` |
| **优先级** | 低 | 中 | 高 |
| **SLA** | 无 | 99% | 99.9% |
| **技术支持** | 社区 | 邮件 | 专属客服 |

---

## 🎯 应用场景

### Free（免费版）

**适合**：
- 个人开发者学习
- 小型项目测试
- 低频调用场景

**限制**：
- 10 次/分钟
- 100 次/天
- 社区支持

**License**：个人非商业使用

---

### Pro（专业版）- ¥49/月

**适合**：
- 独立开发者
- 中小型应用
- 创业团队

**优势**：
- 60 次/分钟
- 无每日限制
- 邮件技术支持

**License**：商业使用，单应用授权

---

### Enterprise（企业版）- ¥199/月

**适合**：
- 企业应用
- 高并发场景
- 关键业务系统

**优势**：
- 120 次/分钟
- 无限制
- 专属客服
- 优先级队列

**License**：企业授权，多应用支持

---

## 🔧 生成 API Key

```bash
# 免费版
node scripts/generate-key.js --tier=free --name="用户名"

# 专业版
node scripts/generate-key.js --tier=pro --name="用户名" --email="user@example.com"

# 企业版
node scripts/generate-key.js --tier=enterprise --name="公司名" --email="corp@example.com"
```

---

## 📈 升级路径

```
Free → Pro → Enterprise
 ↓       ↓        ↓
试用   付费    企业
```

---

## 💳 支付方式（TODO）

- [ ] 支付宝
- [ ] 微信支付
- [ ] 银行转账（企业）
- [ ] API Key 自动激活

---

_创建于 2026-04-26 🌸_
