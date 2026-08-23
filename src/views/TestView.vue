<template>
  <div class="test-container">
    <h1>葱花 · 最短路径测试</h1>

    <div class="demo-section">
      <h3>示例数据（自动计算）</h3>
      <button @click="runDemo">运行演示</button>
      <div v-if="result" class="result-box">
        <p><strong>路径：</strong> {{ result.path?.join(' → ') }}</p>
        <p><strong>总距离：</strong> {{ result.distance?.toFixed(2) }} 米</p>
        <p><strong>坐标序列：</strong></p>
        <pre>{{ JSON.stringify(result.path_coords, null, 2) }}</pre>
      </div>
      <div v-if="error" class="error-box">
        <p>❌ {{ error }}</p>
      </div>
    </div>
  </div>
</template>

<!-- <script>
// 导入算法（ES Module 方式）
import { findShortestPath } from '../../algorithm/pathfinder.js';

export default {
  name: 'TestView',
  data() {
    return {
      result: null,
      error: null,
      // 预置一组地理坐标示例（北京几个地标）
      demoData: {
        coordinate_type: 'wgs84',
        nodes: [
          { id: 'A', coords: [116.397428, 39.90923] },   // 天安门
          { id: 'B', coords: [116.407526, 39.90403] },   // 王府井
          { id: 'C', coords: [116.395844, 39.91358] },   // 北海公园
          { id: 'D', coords: [116.419947, 39.91278] },   // 东直门
        ],
        edges: [
          { from: 'A', to: 'B' },   // weight 自动计算
          { from: 'A', to: 'C' },
          { from: 'B', to: 'D' },
          { from: 'C', to: 'D' },
          // 可添加更多边
        ],
        start: 'A',
        end: 'D',
      },
    };
  },
  methods: {
    runDemo() {
      // 重置之前的结果
      this.result = null;
      this.error = null;

      try {
        // 调用核心算法
        const output = findShortestPath(this.demoData);
        if (output.error) {
          this.error = output.error;
        } else {
          this.result = output;
        }
      } catch (err) {
        this.error = err.message || '计算过程中发生未知错误';
      }
    },
  },
};
</script> -->

<style scoped>
.test-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 12px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
.demo-section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
button {
  background: #42b883;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 1rem;
  border-radius: 6px;
  cursor: pointer;
  transition: 0.2s;
}
button:hover {
  background: #359b6e;
}
.result-box {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #e9f5ee;
  border-left: 4px solid #42b883;
  border-radius: 4px;
}
.error-box {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #fde8e8;
  border-left: 4px solid #e74c3c;
  border-radius: 4px;
  color: #c0392b;
}
pre {
  background: #2d2d2d;
  color: #f0f0f0;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.9rem;
}
</style>