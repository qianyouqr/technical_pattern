<template>
  <div class="home-container">
    <div class="welcome-section">
      <h1 class="welcome-title">欢迎使用 Technical Pattern</h1>
      <p class="welcome-desc">
        基于 Vue3 + TypeScript + Vite 构建的现代化前端项目模板
      </p>
    </div>
    
    <div class="feature-section">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12" :md="6">
          <div class="feature-card">
            <el-icon class="feature-icon" :size="40"><Monitor /></el-icon>
            <h3>Vue 3</h3>
            <p>组合式 API，更好的 TypeScript 支持</p>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="feature-card">
            <el-icon class="feature-icon" :size="40"><SetUp /></el-icon>
            <h3>Vite</h3>
            <p>极速的开发服务器，毫秒级热更新</p>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="feature-card">
            <el-icon class="feature-icon" :size="40"><Grid /></el-icon>
            <h3>Pinia</h3>
            <p>直观、类型安全的状态管理</p>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="feature-card">
            <el-icon class="feature-icon" :size="40"><Connection /></el-icon>
            <h3>Axios</h3>
            <p>完善的 HTTP 请求封装</p>
          </div>
        </el-col>
      </el-row>
    </div>
    
    <div class="info-section">
      <el-card class="info-card">
        <template #header>
          <div class="card-header">
            <span>项目信息</span>
          </div>
        </template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="项目名称">Technical Pattern</el-descriptions-item>
          <el-descriptions-item label="版本">1.0.0</el-descriptions-item>
          <el-descriptions-item label="Vue 版本">3.4+</el-descriptions-item>
          <el-descriptions-item label="构建工具">Vite 5</el-descriptions-item>
          <el-descriptions-item label="UI 框架">Element Plus</el-descriptions-item>
          <el-descriptions-item label="状态管理">Pinia</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Monitor, SetUp, Grid, Connection } from '@element-plus/icons-vue'
</script>

<style scoped lang="scss">
.home-container {
  padding: 20px;
}

.welcome-section {
  text-align: center;
  padding: 60px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: #fff;
  margin-bottom: 20px;
}

.welcome-title {
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 16px;
}

.welcome-desc {
  font-size: 16px;
  opacity: 0.9;
}

.feature-section {
  margin-bottom: 20px;
}

.feature-card {
  text-align: center;
  padding: 30px 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  transition: transform 0.3s ease;
  
  &:hover {
    transform: translateY(-5px);
  }
  
  h3 {
    font-size: 18px;
    color: #303133;
    margin: 16px 0 8px;
  }
  
  p {
    font-size: 14px;
    color: #909399;
    margin: 0;
  }
}

.feature-icon {
  color: #409eff;
}

.info-section {
  .info-card {
    .card-header {
      font-weight: 600;
    }
  }
}
</style>