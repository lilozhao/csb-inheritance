#!/usr/bin/env node
/**
 * LanAPI 测试脚本
 */

const http = require('http');

const HOST = 'localhost';
const PORT = 3100;

// 测试函数
function test(endpoint, method, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    
    const options = {
      hostname: HOST,
      port: PORT,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// 运行测试
async function runTests() {
  console.log('🧪 LanAPI 测试\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 测试 1: 健康检查
  console.log('测试 1: 健康检查');
  try {
    const result = await test('/health', 'GET');
    if (result.status === 200 && result.data.status === 'ok') {
      console.log('✅ 通过\n');
    } else {
      console.log('❌ 失败:', result);
    }
  } catch (e) {
    console.log('❌ 连接失败:', e.message);
    console.log('请确保 LanAPI 服务已启动: npm start\n');
    process.exit(1);
  }
  
  // 测试 2: 模型列表
  console.log('测试 2: 模型列表');
  try {
    const result = await test('/v1/models', 'GET');
    if (result.status === 200 && result.data.object === 'list') {
      console.log('✅ 通过\n');
    } else {
      console.log('❌ 失败:', result);
    }
  } catch (e) {
    console.log('❌ 错误:', e.message);
  }
  
  // 测试 3: 对话接口
  console.log('测试 3: 对话接口');
  try {
    const result = await test('/v1/chat/completions', 'POST', {
      model: 'lanapi',
      messages: [{ role: 'user', content: '你好' }]
    });
    
    if (result.status === 200 && result.data.choices) {
      console.log('✅ 通过');
      console.log('   回复:', result.data.choices[0].message.content.substring(0, 50) + '...\n');
    } else {
      console.log('❌ 失败:', result);
    }
  } catch (e) {
    console.log('❌ 错误:', e.message);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✨ 测试完成\n');
}

runTests();
