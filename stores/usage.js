import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUsageStore = defineStore('usage', () => {
  const ocrUsedToday = ref(0)
  const ocrLimit = ref(Number.POSITIVE_INFINITY)
  const tier = ref('free')
  const premiumFeaturesLocked = ref(true)

  function useOcrScan() {
    ocrUsedToday.value++
    return true
  }

  function unlockPremium() {
    tier.value = 'premium'
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
