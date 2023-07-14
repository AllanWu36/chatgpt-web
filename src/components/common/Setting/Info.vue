<script setup lang='ts'>
import { onMounted, ref } from 'vue'
import { NSpin, useMessage } from 'naive-ui'
import type { AuditConfig, TextAuditServiceProvider } from './model'
import { fetchUserInfo } from '@/api'
import { t } from '@/locales'

const ms = useMessage()

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const testText = ref<string>()
const testText1 = ref<string>('nihao,zheshiyiduanjiantiwenzi')
const serviceOptions: { label: string; key: TextAuditServiceProvider; value: TextAuditServiceProvider }[] = [
  { label: '百度云', key: 'baidu', value: 'baidu' },
]

const userInfo = ref()

async function handleUserInfo() {
  try {
    loading.value = true
    const data = await fetchUserInfo()
    userInfo.value = data
  }
  finally {
    loading.value = false
  }
}

async function updateAuditInfo() {
  saving.value = true
  try {
    const { data } = await fetchUpdateAudit(config.value as AuditConfig)
    config.value = data
    ms.success(t('common.success'))
  }
  catch (error: any) {
    ms.error(error.message)
  }
  saving.value = false
}

async function testAudit() {
  testing.value = true
  try {
    const { message } = await fetchTestAudit(testText.value as string, config.value as AuditConfig) as unknown as { status: string; message: string }
    ms.success(message)
  }
  catch (error: any) {
    ms.error(error.message)
  }
  testing.value = false
}

onMounted(() => {
  handleUserInfo()
})
</script>

<template>
  <NSpin :show="loading">
    <div class="p-4 space-y-5 min-h-[200px]">
      <div class="space-y-6">
        <div class="flex items-center space-x-4">
          <span class="flex-shrink-0 w-[100px]">{{ $t('setting.userVipType') }}</span>
          <div class="flex-1">
            <span> {{ testText1 }}</span>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <span class="flex-shrink-0 w-[100px]">{{ $t('setting.userBalance') }}</span>
          <div class="flex-1">
            <span> {{ testText1 }}</span>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <span class="flex-shrink-0 w-[100px]">{{ $t('setting.userExpireTime') }}</span>
          <div class="flex-1">
            <span> {{ testText1 }}</span>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <span class="flex-shrink-0 w-[100px]">{{ $t('setting.userToken') }}</span>
          <div class="flex-1">
            <span> {{ testText1 }}</span>
          </div>
        </div>
      </div>
    </div>
  </NSpin>
</template>
