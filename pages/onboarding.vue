<script setup>
import { ref } from 'vue'
import { useRouter, useAuthStore, useGroupStore } from '#imports'
import { Eye, EyeOff, ShieldCheck, ArrowRight, PlusCircle, UserPlus2 } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const groupStore = useGroupStore()

const step = ref(1) // 1: Privacy Explainer, 2: Group Setup
const onboardingAction = ref('create') // 'create' or 'join'
const groupName = ref('')
const inviteCode = ref('')
const error = ref('')

function nextStep() {
  step.value = 2
}

function handleOnboardingComplete() {
  error.value = ''
  try {
    if (onboardingAction.value === 'create') {
      if (!groupName.value.trim()) {
        error.value = 'กรุณากรอกชื่อกลุ่ม'
        return
      }
      groupStore.createGroup(groupName.value.trim())
    } else {
      if (!inviteCode.value.trim() || inviteCode.value.trim().length !== 6) {
        error.value = 'รหัสเชิญต้องมีขนาด 6 ตัวอักษร'
        return
      }
      groupStore.joinGroupByCode(inviteCode.value.trim())
    }
    
    authStore.completeOnboarding({
      action: onboardingAction.value,
      groupName: groupName.value,
      inviteCode: inviteCode.value
    })
    
    router.push('/')
  } catch (err) {
    error.value = err.message
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-bg flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-surface-card rounded-xl p-6 border-2 border-border-subtle space-y-6">
      
      <!-- STEP 1: Privacy Explainer -->
      <div v-if="step === 1" class="space-y-5">
        <div class="text-center space-y-1">
          <ShieldCheck class="w-12 h-12 text-primary mx-auto" />
          <h2 class="text-xl font-bold text-ink">{{ $t('settings.personalInfo') }}</h2>
          <p class="text-xs text-ink-muted leading-relaxed">
            MoneyCircle ออกแบบมาเพื่อกระตุ้นนิสัยทางการเงินที่ดี โดยไม่เน้นการแข่งขันด้วยจำนวนทรัพย์สิน
          </p>
        </div>

        <div class="space-y-3">
          <!-- What friends SEE -->
          <div class="p-3.5 bg-duo-green-light/40 border-2 border-primary/20 rounded-xl space-y-2">
            <div class="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-wider">
              <Eye class="w-4 h-4" />
              <span>สิ่งที่คุณและเพื่อนจะมองเห็นร่วมกัน</span>
            </div>
            <ul class="text-xs text-ink space-y-1 pl-6 list-disc leading-relaxed font-bold">
              <li>คะแนนสุขภาพทางการเงิน (0-100)</li>
              <li>ระดับระดับระดับสีเขียว (เช่น มั่นคง, รุ่งเรือง)</li>
              <li>เหรียญรางวัลเกียรติยศ (Badges)</li>
              <li>จำนวนวันบันทึกต่อเนื่อง (Streaks)</li>
            </ul>
          </div>

          <!-- What friends DO NOT SEE -->
          <div class="p-3.5 bg-bubblegum-pink/10 border-2 border-tier-risk/20 rounded-xl space-y-2">
            <div class="flex items-center gap-2 text-xs font-black text-tier-risk uppercase tracking-wider">
              <EyeOff class="w-4 h-4" />
              <span>สิ่งที่จะถูกซ่อนเป็นความลับตลอดไป</span>
            </div>
            <ul class="text-xs text-ink space-y-1 pl-6 list-disc leading-relaxed font-bold">
              <li>จำนวนเงินในบัญชีหรือหนี้สินทั้งหมด</li>
              <li>จำนวนเงินในแต่ละรายการที่คุณบันทึก</li>
              <li>ชื่อร้านค้า แบรนด์สินค้า หรือรายละเอียดส่วนตัว</li>
            </ul>
          </div>
        </div>

        <button 
          @click="nextStep"
          class="btn-primary w-full justify-center gap-2 cursor-pointer text-sm"
        >
          <span>รับทราบและดำเนินการต่อ</span>
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>

      <!-- STEP 2: Group Setup -->
      <div v-else class="space-y-5">
        <div class="text-center space-y-1">
          <h2 class="text-xl font-bold text-ink">สร้างหรือเข้าร่วมกลุ่มเพื่อน</h2>
          <p class="text-xs text-ink-muted leading-relaxed">
            มาร่วมสร้างวินัยทางการเงินร่วมกับกลุ่มของคุณในก้าวถัดไป
          </p>
        </div>

        <!-- Tab switches -->
        <div class="tab-switch">
          <button 
            @click="onboardingAction = 'create'"
            class="tab-switch-btn"
            :class="onboardingAction === 'create' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
          >
            <PlusCircle class="w-3.5 h-3.5 inline mr-1" />
            <span>สร้างกลุ่มใหม่</span>
          </button>
          <button 
            @click="onboardingAction = 'join'"
            class="tab-switch-btn"
            :class="onboardingAction === 'join' ? 'tab-switch-btn--active' : 'tab-switch-btn--inactive'"
          >
            <UserPlus2 class="w-3.5 h-3.5 inline mr-1" />
            <span>เข้าร่วมกลุ่มเพื่อน</span>
          </button>
        </div>

        <!-- Forms -->
        <div class="space-y-4 pt-2">
          <div v-if="onboardingAction === 'create'" class="space-y-1">
            <label class="field-label font-bold text-ink">ชื่อกลุ่มของเพื่อนๆ</label>
            <input 
              v-model="groupName"
              type="text" 
              placeholder="เช่น แก๊งออมเงินกู้โลก..." 
              class="input-field"
            />
          </div>

          <div v-else class="space-y-1">
            <label class="field-label font-bold text-ink">รหัสเชิญเข้าร่วมกลุ่ม (Invite Code)</label>
            <input 
              v-model="inviteCode"
              type="text" 
              placeholder="กรอกรหัสเชิญ 6 ตัวอักษร เช่น DEMO01..." 
              class="input-field uppercase"
              maxlength="6"
            />
          </div>

          <span v-if="error" class="text-xs font-semibold text-tier-risk block">{{ error }}</span>
        </div>

        <button 
          @click="handleOnboardingComplete"
          class="btn-primary w-full justify-center gap-2 cursor-pointer text-sm"
        >
          <span>เข้าสู่หน้าหลักของระบบ</span>
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Disable tap highlighting */
* {
  -webkit-tap-highlight-color: transparent;
}
</style>
