import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUsageStore = defineStore('usage', () => {
  const ocrUsedToday = ref(2)
  const ocrLimit = ref(5)
  const tier = ref('free')
  const premiumFeaturesLocked = ref(true)

  function useOcrScan() {
    if (ocrUsedToday.value < ocrLimit.value) {
      ocrUsedToday.value++
      return true
    }
    return false
  }

  function unlockPremium() {
    tier.value = 'premium'
    ocrLimit.value = 999
    premiumFeaturesLocked.value = false
  }

  return {
    ocrUsedToday,
    ocrLimit,
    tier,
    premiumFeaturesLocked,
    useOcrScan,
    unlockPremium
  }
})
