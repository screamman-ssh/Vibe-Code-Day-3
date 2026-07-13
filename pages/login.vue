<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useAuthStore, useRuntimeConfig } from '#imports'

const router = useRouter()
const authStore = useAuthStore()
const config = useRuntimeConfig()

const error = ref('')

onMounted(() => {
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.onload = () => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: config.public.googleClientId,
        callback: handleGoogleCallback
      })

      // Render on mobile button
      const mobileBtn = document.getElementById('google-signin-btn')
      if (mobileBtn) {
        const mobileWidth = Math.min(380, mobileBtn.parentElement?.offsetWidth || 320)
        window.google.accounts.id.renderButton(
          mobileBtn,
          { theme: 'outline', size: 'large', shape: 'pill', width: mobileWidth }
        )
      }

      // Render on desktop button
      const desktopBtn = document.getElementById('google-signin-btn-desktop')
      if (desktopBtn) {
        window.google.accounts.id.renderButton(
          desktopBtn,
          { theme: 'outline', size: 'large', shape: 'pill', width: 380 }
        )
      }
    }
  }
  document.head.appendChild(script)
})

async function handleGoogleCallback(response) {
  try {
    await authStore.loginWithGoogle(response.credential)
    router.push('/')
  } catch (err) {
    error.value = 'การเข้าสู่ระบบด้วย Google ล้มเหลว'
  }
}
</script>

<template>
  <div class="login-page min-h-dvh relative overflow-hidden">
    
    <!-- Full-screen Animated Wave Background -->
    <div class="wave-bg">
      <!-- Floating Orbs -->
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
      <div class="orb orb-4"></div>
      <div class="orb orb-5"></div>

      <!-- Wave Layers -->
      <svg class="wave-layer wave-layer-6" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,160 C120,100 240,200 360,160 C480,120 600,220 720,180 C840,140 960,240 1080,200 C1200,160 1320,100 1440,140 L1440,320 L0,320 Z" />
      </svg>
      <svg class="wave-layer wave-layer-5" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,200 C180,140 360,240 540,180 C720,120 900,260 1080,200 C1200,160 1380,220 1440,180 L1440,320 L0,320 Z" />
      </svg>
      <svg class="wave-layer wave-layer-4" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,220 C160,180 320,260 480,220 C640,180 800,280 960,240 C1120,200 1280,260 1440,220 L1440,320 L0,320 Z" />
      </svg>
      <svg class="wave-layer wave-layer-3" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,240 C200,200 400,280 600,240 C800,200 1000,300 1200,260 C1320,240 1400,220 1440,250 L1440,320 L0,320 Z" />
      </svg>
      <svg class="wave-layer wave-layer-2" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,260 C240,230 480,290 720,260 C960,230 1200,300 1440,270 L1440,320 L0,320 Z" />
      </svg>
      <svg class="wave-layer wave-layer-1" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,280 C180,260 360,300 540,280 C720,260 900,310 1080,290 C1200,275 1380,295 1440,280 L1440,320 L0,320 Z" />
      </svg>
    </div>

    <!-- ═══ MOBILE LAYOUT (< md) ═══ -->
    <div class="flex md:hidden flex-col min-h-dvh relative z-10">
      <!-- Top: Branding floating over waves -->
      <div class="flex-1 flex flex-col justify-center px-7 pt-safe-top pb-4">
        <h1 class="text-xl font-black font-brand text-primary tracking-tight mb-5 drop-shadow-sm">MoneyCircle</h1>
        <h2 class="text-[1.75rem] leading-[1.15] font-black font-brand text-[#131f24] dark:text-white tracking-tight drop-shadow-sm">
          Financial Habits?!
        </h2>
        <h3 class="text-[1.75rem] leading-[1.15] font-black font-brand text-[#131f24] dark:text-white tracking-tight mt-1 drop-shadow-sm">
          We can <span class="shimmer-text">Take Care</span> of that Easy!
        </h3>
        <p class="text-xs font-semibold text-ink-muted leading-relaxed max-w-xs mt-4 drop-shadow-sm">
          Score your habits, not your wealth. Join MoneyCircle, connect with friends, and reach your goals together.
        </p>
      </div>

      <!-- Bottom: Compact glassmorphic login card -->
      <div class="mx-5 mb-8 p-5 rounded-2xl bg-surface-card/65 dark:bg-[#131f24]/50 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-xl">
        <div class="flex flex-col items-center space-y-3">
          <div class="flex w-full justify-center">
            <div id="google-signin-btn" class="w-full max-w-[380px] flex justify-center"></div>
          </div>
          <span v-if="error" class="text-xs font-semibold text-tier-risk block text-center">{{ error }}</span>
          <div class="text-nano text-ink-muted/80 max-w-[340px] leading-relaxed text-center">
            *ข้อแนะนำทั้งหมดเป็นข้อมูลเพื่อการศึกษาทางการเงินเท่านั้น ไม่ใช่คำแนะนำทางการเงินที่ได้รับใบอนุญาต*
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ DESKTOP LAYOUT (≥ md) ═══ -->
    <div class="hidden md:flex items-center justify-center min-h-dvh p-8 relative z-10">
      <div class="w-full max-w-5xl bg-surface-card/85 dark:bg-[#131f24]/85 backdrop-blur-xl rounded-[2rem] border-2 border-border-subtle overflow-hidden p-5 grid grid-cols-12 gap-6 min-h-[600px] shadow-2xl">
        
        <!-- Left Panel -->
        <div class="col-span-7 flex flex-col justify-between p-10 space-y-8">
          <div>
            <h1 class="text-2xl font-black font-brand text-primary tracking-tight">MoneyCircle</h1>
          </div>

          <div class="space-y-4">
            <h2 class="text-5xl font-black font-brand text-[#131f24] dark:text-white tracking-tight leading-tight">
              Financial Habits?!
            </h2>
            <h3 class="text-5xl font-black font-brand text-[#131f24] dark:text-white tracking-tight leading-tight">
              We can <span class="shimmer-text">Take Care</span> of that Easy!
            </h3>
            <p class="text-sm font-semibold text-ink-muted leading-relaxed max-w-md">
              Score your habits, not your wealth. Join MoneyCircle, connect with friends, and reach your goals together.
            </p>
          </div>

          <div class="space-y-4 flex flex-col items-center w-full">
            <div class="flex w-full justify-center">
              <div id="google-signin-btn-desktop" class="w-full max-w-[380px] flex justify-center"></div>
            </div>
            <span v-if="error" class="text-xs font-semibold text-tier-risk block text-center">{{ error }}</span>
            <div class="text-nano text-ink-muted max-w-[380px] leading-relaxed text-center">
              *ข้อแนะนำทั้งหมดเป็นข้อมูลเพื่อการศึกษาทางการเงินเท่านั้น ไม่ใช่คำแนะนำทางการเงินที่ได้รับใบอนุญาต*
            </div>
          </div>
        </div>

        <!-- Right Panel (Image) -->
        <div class="col-span-5 bg-[#fff0f2] rounded-[1.75rem] overflow-hidden flex items-center justify-center min-h-full">
          <img 
            src="/images/piggy_bank_login.png" 
            alt="Piggy Bank" 
            class="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* ═══ Theme variables (unscoped so .dark ancestor matches) ═══ */
.login-page {
  --wave-bg: linear-gradient(160deg, #fff5f7 0%, #fef0e8 25%, #f0f4ff 55%, #e8f4fd 80%, #fff5f7 100%);
  --w6-fill: #1cb0f6; --w5-fill: #a570ff; --w4-fill: #cc348d;
  --w3-fill: #ffc700; --w2-fill: #1cb0f6; --w1-fill: #cc348d;
  --orb-opacity: 0.35;
}
.dark .login-page,
:where(.dark) .login-page {
  --wave-bg: linear-gradient(160deg, #0a0f14 0%, #0d1520 30%, #101825 60%, #0d1a28 85%, #0a0f14 100%);
  --w6-fill: #a570ff; --w5-fill: #1cb0f6; --w4-fill: #cc348d;
  --w3-fill: #ffc700; --w2-fill: #a570ff; --w1-fill: #1cb0f6;
  --orb-opacity: 0.2;
}
</style>

<style scoped>
* {
  -webkit-tap-highlight-color: transparent;
}

.login-page {
  background: var(--wave-bg);
}

/* ═══ Shimmer text effect ═══ */
.shimmer-text {
  background: linear-gradient(90deg, #BE1A1A 0%, #ff6b6b 40%, #BE1A1A 80%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* ═══ Wave container ═══ */
.wave-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.wave-layer {
  position: absolute;
  left: -5%;
  width: 110%;
  display: block;
}

.wave-layer-6 {
  bottom: 0; height: 85%; opacity: 0.2;
  animation: wave-drift-reverse 28s ease-in-out infinite;
}
.wave-layer-6 path { fill: var(--w6-fill); }

.wave-layer-5 {
  bottom: 0; height: 72%; opacity: 0.25;
  animation: wave-drift 24s ease-in-out infinite;
}
.wave-layer-5 path { fill: var(--w5-fill); }

.wave-layer-4 {
  bottom: 0; height: 60%; opacity: 0.28;
  animation: wave-drift-reverse 20s ease-in-out infinite;
}
.wave-layer-4 path { fill: var(--w4-fill); }

.wave-layer-3 {
  bottom: 0; height: 48%; opacity: 0.3;
  animation: wave-drift 16s ease-in-out infinite;
}
.wave-layer-3 path { fill: var(--w3-fill); }

.wave-layer-2 {
  bottom: 0; height: 36%; opacity: 0.35;
  animation: wave-drift-reverse 13s ease-in-out infinite;
}
.wave-layer-2 path { fill: var(--w2-fill); }

.wave-layer-1 {
  bottom: 0; height: 24%; opacity: 0.4;
  animation: wave-drift 10s ease-in-out infinite;
}
.wave-layer-1 path { fill: var(--w1-fill); }

/* ═══ Floating Orbs ═══ */
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(50px);
  opacity: var(--orb-opacity);
}

.orb-1 {
  width: 180px; height: 180px;
  background: radial-gradient(circle, #1cb0f6 0%, transparent 70%);
  top: 8%; left: 5%;
  animation: orb-float-1 20s ease-in-out infinite;
}
.orb-2 {
  width: 220px; height: 220px;
  background: radial-gradient(circle, #cc348d 0%, transparent 70%);
  top: 20%; right: 0%;
  animation: orb-float-2 25s ease-in-out infinite;
}
.orb-3 {
  width: 160px; height: 160px;
  background: radial-gradient(circle, #a570ff 0%, transparent 70%);
  bottom: 35%; left: 60%;
  animation: orb-float-3 18s ease-in-out infinite;
}
.orb-4 {
  width: 140px; height: 140px;
  background: radial-gradient(circle, #ffc700 0%, transparent 70%);
  top: 45%; left: 15%;
  animation: orb-float-2 22s ease-in-out infinite reverse;
}
.orb-5 {
  width: 200px; height: 200px;
  background: radial-gradient(circle, #1cb0f6 0%, transparent 70%);
  bottom: 15%; right: 10%;
  animation: orb-float-1 26s ease-in-out infinite reverse;
}

@media (min-width: 768px) {
  .orb { filter: blur(70px); }
  .orb-1 { width: 300px; height: 300px; }
  .orb-2 { width: 400px; height: 400px; }
  .orb-3 { width: 250px; height: 250px; }
  .orb-4 { width: 200px; height: 200px; }
  .orb-5 { width: 350px; height: 350px; }
}

/* ═══ Animations ═══ */
@keyframes wave-drift {
  0%, 100% { transform: translateX(0) scaleY(1); }
  25%      { transform: translateX(-2%) scaleY(1.04); }
  50%      { transform: translateX(0) scaleY(0.96); }
  75%      { transform: translateX(2%) scaleY(1.02); }
}
@keyframes wave-drift-reverse {
  0%, 100% { transform: translateX(0) scaleY(1); }
  25%      { transform: translateX(2%) scaleY(0.97); }
  50%      { transform: translateX(0) scaleY(1.05); }
  75%      { transform: translateX(-2%) scaleY(0.98); }
}

@keyframes orb-float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(30px, -40px) scale(1.1); }
  66%      { transform: translate(-20px, 20px) scale(0.95); }
}
@keyframes orb-float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(-40px, 30px) scale(1.05); }
  66%      { transform: translate(25px, -35px) scale(0.9); }
}
@keyframes orb-float-3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(35px, -25px) scale(1.08); }
}
</style>
