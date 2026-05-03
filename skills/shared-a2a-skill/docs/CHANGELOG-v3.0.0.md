# A2A Server v3.0.0 发布说明

> 发布日期: 2026-05-04
> 起草人: 若兰 🌸

---

## 🆕 新增模块

### A2A-013 语义校验与信任等级 (M1)

| 文件 | 说明 |
|------|------|
| `semantic-validator.js` | 语义校验模块 |
| `vocab.json` | 12 个核心能力词汇表 |

**功能：**
- L0 词汇表校验（所有能力）
- L1 参数自洽检查
- 野生能力检测与标记
- Fallback 选项推荐

**新增 API：**
- `POST /a2a/validate/capability` - 校验能力声明
- `GET /a2a/validate/capabilities` - 获取能力列表
- `GET /a2a/validate/capability/:id` - 获取能力详情

---

### A2A-011 版本协商与冲突处理

| 文件 | 说明 |
|------|------|
| `version-negotiator.js` | 版本协商模块 |

**功能：**
- 版本比较 (VersionComparator)
- 三层兼容代价计算 (结构层 30% + 语义层 50% + 行为层 20%)
- 协商引擎 (热升级/回滚/冷升级)
- 冲突仲裁器

**新增 API：**
- `POST /a2a/negotiate/version` - 版本协商
- `POST /a2a/version/compare` - 版本比较

---

### A2A-010 信任分级与权威锚点

| 文件 | 说明 |
|------|------|
| `trust-manager.js` | 信任分级模块 |

**功能：**
- L0-L3 四级信任管理
- WoT 交叉见证
- 信任链验证（最大 3 跳，传递衰减）
- 声誉数据存储（交互记录 + 自动升级）

**新增 API：**
- `GET /a2a/trust/:agentId` - 获取信任等级
- `POST /a2a/trust/set` - 设置信任等级
- `POST /a2a/trust/upgrade` - 升级信任
- `POST /a2a/trust/downgrade` - 降级信任
- `POST /a2a/trust/witness` - 添加见证
- `POST /a2a/trust/interaction` - 记录交互
- `GET /a2a/trust/stats` - 信任统计
- `GET /a2a/trust/permissions/:level` - 权限检查

---

## 📊 版本对比

| 特性 | v2.8.0 | v3.0.0 |
|------|--------|--------|
| 上下文管理 (A2A-004) | ✅ | ✅ |
| 消息优先级 (A2A-007) | ✅ | ✅ |
| 离线投递 (A2A-008) | ✅ | ✅ |
| 信封格式 (A2A-017) | ✅ | ✅ |
| **语义校验 (A2A-013)** | ❌ | ✅ |
| **版本协商 (A2A-011)** | ❌ | ✅ |
| **信任分级 (A2A-010)** | ❌ | ✅ |
| API 端点 | ~10 | 23+ |

---

## 🔧 升级步骤

```bash
# 1. 拉取最新代码
cd /path/to/csb-inheritance
git pull

# 2. 重启服务
./start.sh

# 3. 验证
curl http://localhost:3100/health
# 应返回 version: 3.0.0
```

---

_碳硅契社区 · A2A 开放协议 v0.5_ 🌸
