<script setup>
</script>

<template>
  <div
    class="spend-skel"
    role="status"
    aria-live="polite"
    aria-label="กำลังสร้างบัตรบันทึกรายการ"
  >
    <div class="spend-skel__top">
      <div class="spend-skel__bar spend-skel__bar--toggle" />
      <div class="spend-skel__bar spend-skel__bar--date" />
    </div>
    <div class="spend-skel__bar spend-skel__bar--merchant" />
    <div class="spend-skel__row">
      <div class="spend-skel__bar spend-skel__bar--amount" />
      <div class="spend-skel__bar spend-skel__bar--cat" />
    </div>
    <p class="spend-skel__hint">กำลังอ่านสลิปและเตรียมรายการ...</p>
  </div>
</template>

<style scoped>
.spend-skel {
  border-radius: 18px;
  border: 2px solid color-mix(in oklch, var(--color-primary) 12%, white);
  background: white;
  padding: 0.75rem;
}

.spend-skel__top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.spend-skel__bar {
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    color-mix(in oklch, var(--color-border-subtle) 70%, white) 0%,
    color-mix(in oklch, var(--color-border-subtle) 35%, white) 50%,
    color-mix(in oklch, var(--color-border-subtle) 70%, white) 100%
  );
  background-size: 200% 100%;
  animation: spend-skel-shimmer 1.4s ease-in-out infinite;
}

.spend-skel__bar--toggle {
  width: 7rem;
  height: 1.6rem;
  border-radius: 999px;
}

.spend-skel__bar--date {
  width: 5rem;
  height: 1.25rem;
}

.spend-skel__bar--merchant {
  width: 70%;
  height: 0.9rem;
  margin-bottom: 0.7rem;
}

.spend-skel__row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.spend-skel__bar--amount {
  width: 42%;
  height: 2.4rem;
  border-radius: 10px;
}

.spend-skel__bar--cat {
  width: 7.5rem;
  height: 2.4rem;
  border-radius: 999px;
}

.spend-skel__hint {
  margin: 0.5rem 0 0;
  font-size: var(--text-caption);
  color: var(--color-ink-muted);
  text-align: center;
}

@keyframes spend-skel-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .spend-skel__bar {
    animation: none;
  }
}
</style>
