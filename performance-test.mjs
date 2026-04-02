/**
 * 性能测试脚本 (ES Module 版本)
 * 用于验证优化效果，特别是针对Mermaid渲染、主题切换和内容处理功能
 */

import fs from 'fs';
import path from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';

// 启用性能观察器
const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration.toFixed(2)}ms`);
  });
});
obs.observe({ entryTypes: ['measure'] });

/**
 * 测试Regex性能
 */
function testRegexPerformance() {
  console.log('\n=== 测试 正则表达式 性能 ===');
  
  // 测试CJK字符匹配
  const testText = '这是一段测试文本，包含中英文混合内容。This is a test text with mixed Chinese and English content.';
  const iterations = 10000;
  
  // 测试match性能
  performance.mark('regex-match-start');
  for (let i = 0; i < iterations; i++) {
    const cjkPattern = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/g;
    const matches = testText.match(cjkPattern);
  }
  performance.mark('regex-match-end');
  performance.measure('Regex match (10,000次)', 'regex-match-start', 'regex-match-end');
  
  // 测试matchAll性能
  performance.mark('regex-matchAll-start');
  for (let i = 0; i < iterations; i++) {
    const cjkPattern = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u3000-\u303f\uff00-\uffef]/g;
    const matches = [...testText.matchAll(cjkPattern)];
  }
  performance.mark('regex-matchAll-end');
  performance.measure('Regex matchAll (10,000次)', 'regex-matchAll-start', 'regex-matchAll-end');
  
  // 测试URL匹配性能
  const urlPattern = / w-([0-9]+)%/;
  const testAltText = '这是一张图片 w-50%';
  
  performance.mark('url-regex-start');
  for (let i = 0; i < iterations; i++) {
    const match = testAltText.match(urlPattern);
  }
  performance.mark('url-regex-end');
  performance.measure('URL Regex match (10,000次)', 'url-regex-start', 'url-regex-end');
}

/**
 * 测试字符串操作性能
 */
function testStringOperations() {
  console.log('\n=== 测试 字符串操作 性能 ===');
  
  const testText = '这是一段很长的测试文本，重复多次以便测试性能。';
  const repeatedText = testText.repeat(1000); // 1000次重复
  const iterations = 1000;
  
  // 测试字符串替换性能
  performance.mark('string-replace-start');
  for (let i = 0; i < iterations; i++) {
    repeatedText.replace(/测试/g, '性能测试');
  }
  performance.mark('string-replace-end');
  performance.measure('String replace (1,000次)', 'string-replace-start', 'string-replace-end');
  
  // 测试字符串分割性能
  performance.mark('string-split-start');
  for (let i = 0; i < iterations; i++) {
    repeatedText.split('，');
  }
  performance.mark('string-split-end');
  performance.measure('String split (1,000次)', 'string-split-start', 'string-split-end');
}

/**
 * 测试内存使用情况
 */
function testMemoryUsage() {
  console.log('\n=== 测试 内存使用情况 ===');
  
  const initialMemory = process.memoryUsage();
  console.log('初始内存使用:');
  console.log(`  RSS: ${Math.round(initialMemory.rss / 1024 / 1024)} MB`);
  console.log(`  Heap Total: ${Math.round(initialMemory.heapTotal / 1024 / 1024)} MB`);
  console.log(`  Heap Used: ${Math.round(initialMemory.heapUsed / 1024 / 1024)} MB`);
  
  // 执行内存密集型操作
  const largeArray = new Array(1000000).fill('x'.repeat(100));
  
  const afterMemory = process.memoryUsage();
  console.log('操作后内存使用:');
  console.log(`  RSS: ${Math.round(afterMemory.rss / 1024 / 1024)} MB`);
  console.log(`  Heap Total: ${Math.round(afterMemory.heapTotal / 1024 / 1024)} MB`);
  console.log(`  Heap Used: ${Math.round(afterMemory.heapUsed / 1024 / 1024)} MB`);
  
  console.log('内存增长:');
  console.log(`  RSS: ${Math.round((afterMemory.rss - initialMemory.rss) / 1024 / 1024)} MB`);
  console.log(`  Heap Used: ${Math.round((afterMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)} MB`);
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('性能测试开始...');
  
  try {
    // 运行各个测试
    testRegexPerformance();
    testStringOperations();
    testMemoryUsage();
    
    console.log('\n=== 所有测试完成 ===');
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    obs.disconnect();
  }
}

// 运行测试
runTests();