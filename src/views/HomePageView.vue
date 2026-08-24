<template>
  <div class="hp">
    <!-- 顶部：欢迎语横幅 -->
    <section class="hp-hero">
      <div class="hp-hero-inner">
        <h1 class="hp-greeting">{{ greeting }}</h1>
        <p class="hp-date">{{ todayText }}</p>
      </div>
    </section>

    <!-- 功能模块概览 -->
    <section class="hp-section">
      <h2 class="hp-section-title">功能模块</h2>
      <p class="hp-tip">业务数据模块正在开发中，敬请期待。</p>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const greeting = ref('')
const todayText = ref('')
const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
function buildHero() {
  const d = new Date()
  const h = d.getHours()
  greeting.value = h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好'
  todayText.value = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`
}

onMounted(() => {
  buildHero()
})
</script>

<style scoped>
.hp {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 顶部横幅 */
.hp-hero {
  position: relative;
  overflow: hidden;
  text-align: center;
  padding: 38px 20px 34px;
  border-radius: 16px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  box-shadow: 0 10px 28px rgba(13, 128, 224, 0.22);
}
.hp-hero::after {
  content: '';
  position: absolute;
  right: -60px;
  top: -60px;
  width: 200px;
  height: 200px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 50%;
}
.hp-greeting {
  position: relative;
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}
.hp-date {
  position: relative;
  margin: 10px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

/* 区块标题 */
.hp-section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: #1d2129;
}
.hp-tip {
  margin: 0;
  font-size: 14px;
  color: #8a9099;
}
</style>
