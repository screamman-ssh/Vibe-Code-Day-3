import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useScoreStore = defineStore('score', () => {
  const currentScore = ref({
    totalScore: 72,
    tier: 'Steady',
    tierTh: 'มั่นคง',
    streakDays: 8,
    daysActive: [true, true, true, false, true, true, true, true], // Past 7 days + today
    dimensions: [
      { name: 'budgetAdherence', score: 80, weight: 25, label: 'การคุมงบประมาณ', valueText: 'อยู่ในเกณฑ์ดี คุมส่วนใหญ่ได้ดี' },
      { name: 'savingsRate', score: 70, weight: 20, label: 'อัตราการออมเงิน', valueText: 'อัตราออมเงินเดือนนี้ 8.5%' },
      { name: 'debtHealth', score: 65, weight: 25, label: 'สุขภาพหนี้สิน', valueText: 'หนี้สินต่อรายได้ (DTI) 28%' },
      { name: 'emergencyFund', score: 60, weight: 15, label: 'เงินสำรองฉุกเฉิน', valueText: 'สำรองประมาณ 1.8 เดือน' },
      { name: 'consistencyStreak', score: 80, weight: 15, label: 'ความต่อเนื่องในการจด', valueText: 'บันทึกรายรับรายจ่ายสม่ำเสมอ' }
    ]
  })

  function refreshScore() {
    // Mock refresh logic if needed
  }

  return {
    currentScore,
    refreshScore
  }
})
