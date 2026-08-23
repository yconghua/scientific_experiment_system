<template>
  <div class="module">
    <h2 class="module-title">{{ title }}</h2>
    <p class="module-tip">正在开发中</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => route.meta.title || '导航栏')
</script>

<style scoped>
.module {
  background: #fff;
  border-radius: 10px;
  padding: 24px;
  min-height: 100%;
}
.module-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px;
}
.module-tip {
  font-size: 14px;
  color: #8a9099;
  margin: 0;
}
</style>
