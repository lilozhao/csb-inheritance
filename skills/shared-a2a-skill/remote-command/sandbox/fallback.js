/**
 * A2A 远程命令执行 - Fallback 沙箱
 * 纯代码级限制，适用于所有平台
 */

const { spawn } = require('child_process');
const { SandboxProvider } = require('./index.js');

class FallbackSandbox extends SandboxProvider {
  constructor(config = {}) {
    super();
    this.config = {
      timeout: config.timeout || 30000,
      memoryLimit: config.memoryLimit || 128 * 1024 * 1024, // 128MB
      maxOutputSize: config.maxOutputSize || 1024 * 1024, // 1MB
      ...config
    };
  }

  /**
   * 执行命令
   * @param {string} commandType - 命令类型
   * @param {Object} params - 命令参数
   * @returns {Promise<Object>}
   */
  async execute(commandType, params) {
    console.log(`[A2A-CMD] Fallback sandbox executing: ${commandType}`);
    
    const script = this.buildCommandScript(commandType, params);
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['-e', script], {
        timeout: this.config.timeout,
        detached: false,
        env: {
          ...process.env,
          // 限制内存
          NODE_OPTIONS: `--max-old-space-size=${Math.floor(this.config.memoryLimit / 1024 / 1024)}`
        }
      });

      let stdout = '';
      let stderr = '';
      let outputSize = 0;

      child.stdout.on('data', (data) => {
        outputSize += data.length;
        if (outputSize > this.config.maxOutputSize) {
          child.kill('SIGTERM');
          reject(new Error('Output size limit exceeded'));
          return;
        }
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error(`Invalid output format: ${stdout}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Process error: ${err.message}`));
      });
    });
  }

  /**
   * 构建命令脚本
   */
  buildCommandScript(commandType, params) {
    const safeParams = JSON.stringify(params || {});
    
    const commandImplementations = {
      'system.status': `
        (() => {
          const os = require('os');
          return {
            success: true,
            data: {
              platform: os.platform(),
              arch: os.arch(),
              uptime: os.uptime(),
              loadavg: os.loadavg(),
              memory: {
                total: os.totalmem(),
                free: os.freemem()
              },
              cpus: os.cpus().length
            }
          };
        })()
      `,
      'skill.list': `
        (() => {
          const fs = require('fs');
          const path = '/home/node/.openclaw/workspace/skills';
          try {
            const items = fs.readdirSync(path, { withFileTypes: true });
            const skills = items
              .filter(item => item.isDirectory())
              .map(item => ({ name: item.name }));
            return { success: true, data: skills };
          } catch (e) {
            return { success: false, error: 'Cannot read skills directory: ' + e.message };
          }
        })()
      `,
      'skill.info': `
        (() => {
          const fs = require('fs');
          const path = '/home/node/.openclaw/workspace/skills/' + ${safeParams}.skill + '/SKILL.md';
          try {
            const content = fs.readFileSync(path, 'utf8');
            return { success: true, data: { name: ${safeParams}.skill, readme: content.substring(0, 500) } };
          } catch (e) {
            return { success: false, error: 'Skill not found: ' + e.message };
          }
        })()
      `,
      'agent.health': `
        ({
          success: true,
          data: {
            status: 'healthy',
            timestamp: Date.now()
          }
        })
      `,
      'agent.configure': `
        (() => {
          const fs = require('fs');
          const path = require('path');
          
          const params = ${safeParams};
          const action = params.action || 'set';
          const configPath = params.configPath;
          const value = params.value;
          
          // 允许修改的配置项白名单
          const ALLOWED_CONFIGS = ['capabilities', 'personality', 'llm.model'];
          
          if (!ALLOWED_CONFIGS.includes(configPath)) {
            return { success: false, error: 'Config path not allowed: ' + configPath };
          }
          
          // 读取 identity.json
          const identityPath = process.env.IDENTITY_PATH || '/home/node/.openclaw/workspace/shared-a2a-skill/identity.json';
          
          try {
            // 备份
            const backupDir = path.dirname(identityPath) + '/.config-backups';
            if (!fs.existsSync(backupDir)) {
              fs.mkdirSync(backupDir, { recursive: true });
            }
            
            let identity = {};
            if (fs.existsSync(identityPath)) {
              identity = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
              // 备份当前配置
              const backupPath = backupDir + '/identity_' + Date.now() + '.json';
              fs.writeFileSync(backupPath, JSON.stringify(identity, null, 2));
            }
            
            // 获取旧值
            const keys = configPath.split('.');
            let current = identity;
            for (let i = 0; i < keys.length - 1; i++) {
              current = current[keys[i]] || {};
            }
            const oldValue = current[keys[keys.length - 1]];
            
            // 设置新值
            if (action === 'set') {
              current[keys[keys.length - 1]] = value;
            } else if (action === 'merge' && typeof value === 'object') {
              current[keys[keys.length - 1]] = { ...oldValue, ...value };
            }
            
            // 写回文件
            fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2));
            
            return {
              success: true,
              data: {
                configPath,
                action,
                oldValue,
                newValue: value,
                needsRestart: true
              }
            };
          } catch (e) {
            return { success: false, error: 'Config update failed: ' + e.message };
          }
        })()
      `
    };

    const implementation = commandImplementations[commandType];
    if (!implementation) {
      return `({ success: false, error: 'Unknown command: ${commandType}' })`;
    }

    return `console.log(JSON.stringify(${implementation}));`;
  }

  getPlatform() {
    return 'fallback';
  }

  async health() {
    return true; // Fallback 总是可用
  }
}

module.exports = { FallbackSandbox };
