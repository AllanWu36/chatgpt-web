<script setup lang='ts'>
import { onMounted, ref } from 'vue'
import { NSpin, useMessage } from 'naive-ui'
import type { TextAuditServiceProvider } from './model'
import { fetchUserInfo } from '@/api'
const ms = useMessage()

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const testText = ref<string>()
const testText1 = ref<string>('nihao,zheshiyiduanjiantiwenzi')
const serviceOptions: { label: string; key: TextAuditServiceProvider; value: TextAuditServiceProvider }[] = [
  { label: '百度云', key: 'baidu', value: 'baidu' },
]

const userInfo = ref({ vip: 0, balance: 0, expire_time: 0, total_token: 0 })

async function handleUserInfo() {
  try {
    loading.value = true

    // 第一种写法
    // const vData = (await fetchUserInfo()).data
    // userInfo.value.vip = vData.vip
    // userInfo.value.balance = vData.balance
    // userInfo.value.expire_time = vData.expire_time
    // userInfo.value.total_token = vData.total_token

    // 第二种写法
    const data = await fetchUserInfo()
    userInfo.value = { ...data.data }
  }
  catch (error) {
    // 根据需要进行错误处理，例如显示错误消息给用户
  }
  finally {
    loading.value = false
  }
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
            <span> {{ userInfo.vip }}</span>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <span class="flex-shrink-0 w-[100px]">{{ $t('setting.userBalance') }}</span>
          <div class="flex-1">
            <span> {{ userInfo.balance }}</span>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <span class="flex-shrink-0 w-[100px]">{{ $t('setting.userExpireTime') }}</span>
          <div class="flex-1">
            <span> {{ userInfo.expire_time }}</span>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <span class="flex-shrink-0 w-[100px]">{{ $t('setting.userToken') }}</span>
          <div class="flex-1">
            <span> {{ userInfo.total_token }}</span>
          </div>
        </div>
      </div>
    </div>
  </NSpin>
</template>
