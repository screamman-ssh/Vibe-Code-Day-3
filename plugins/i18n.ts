import { createI18n } from 'vue-i18n'
import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  let savedLocale = 'th'
  if (typeof window !== 'undefined') {
    savedLocale = localStorage.getItem('locale') || 'th'
  }

  const i18n = createI18n({
    legacy: false,
    globalInstall: true,
    locale: savedLocale,
    fallbackLocale: 'en',
    messages: {
      en: {
        nav: {
          dashboard: 'Dashboard',
          hub: 'App Hub',
          tracker: 'Money Tracker',
          budget: 'Budget',
          debts: 'Debts',
          chat: 'AI Coach',
          circle: 'Circle',
          social: 'Community',
          settings: 'Settings',
          logout: 'Logout'
        },
        shell: {
          welcome: 'Welcome',
          freeAccount: 'Free Account',
          premiumMember: 'Premium Member',
          logoutConfirm: 'Are you sure you want to log out?'
        },
        dialog: {
          confirm: 'Confirm',
          cancel: 'Cancel',
          ok: 'OK'
        },
        score: {
          healthTitle: 'Financial Health Score',
          weeklyDiscipline: 'Weekly Discipline',
          streakDays: 'Streak {days} days',
          daysLabels: ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su']
        },
        dashboard: {
          welcome: 'Welcome',
          circleActivity: 'Circle Activity: {name}',
          viewRank: 'View Rank',
          wallet: 'Wallet',
          income: 'Income',
          expense: 'Expense',
          budgetControl: 'Budget Control',
          spent: 'Spent',
          outOf: 'out of {total}',
          debts: 'Debts',
          debtsDesc: 'Manage debt by account',
          totalDebt: 'Total Accumulative Debt',
          premiumBadge: 'Premium Feature',
          premiumTitle: 'Get AI advice for your budget and savings plan',
          premiumDesc: 'Receive personalized debt strategies and daily category advice.'
        },
        settings: {
          title: 'User Settings',
          lead: 'Modify your profile and manage your financial plans',
          personalInfo: 'Personal Information',
          displayName: 'Display Name',
          avatarUrl: 'Avatar URL',
          emergencyFund: 'Emergency Fund Target (THB)',
          emergencyFundHint: '*Score evaluated based on average monthly expenses*',
          save: 'Save Profile Settings',
          saveSuccess: 'Settings saved successfully!',
          aiSettings: 'AI Settings',
          apiKey: 'AI API Key for OCR & AI Coach (Bearer Token)',
          apiKeyHint: '*Key is saved in browser storage to connect directly to AI servers*',
          membership: 'Membership Package',
          currentPackage: 'Current Package',
          upgradeBtn: 'Upgrade to Premium (Beta)',
          lifetimeActive: 'Lifetime Active',
          ocrQuota: 'OCR quota today:',
          disclaimer: 'MoneyCircle and AI advice are for educational and tracking purposes, not official financial advice.',
          logoutBtn: 'Log Out',
          langSelect: 'System Language',
          langTh: 'ไทย (Thai)',
          langEn: 'English (English)',
          enterDisplayName: 'Please enter display name',
          themeSelect: 'Theme / Appearance',
          themeLight: 'Light Mode',
          themeDark: 'Dark Mode',
          themeSystem: 'System Default'
        }
      },
      th: {
        nav: {
          dashboard: 'แดชบอร์ด',
          hub: 'ศูนย์แอป',
          tracker: 'บันทึกเงิน',
          budget: 'งบประมาณ',
          debts: 'จัดการหนี้สิน',
          chat: 'AI โค้ชการเงิน',
          circle: 'กลุ่มเพื่อน',
          social: 'ชุมชน',
          settings: 'ตั้งค่าระบบ',
          logout: 'ออกจากระบบ'
        },
        shell: {
          welcome: 'ยินดีต้อนรับ',
          freeAccount: 'บัญชีใช้งานฟรี',
          premiumMember: 'สมาชิกพรีเมียม',
          logoutConfirm: 'คุณต้องการออกจากระบบใช่หรือไม่?'
        },
        dialog: {
          confirm: 'ยืนยัน',
          cancel: 'ยกเลิก',
          ok: 'ตกลง'
        },
        score: {
          healthTitle: 'คะแนนสุขภาพเงิน',
          weeklyDiscipline: 'วินัยรายสัปดาห์',
          streakDays: 'บันทึกต่อเนื่อง {days} วัน',
          daysLabels: ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
        },
        dashboard: {
          welcome: 'ยินดีต้อนรับ',
          circleActivity: 'ความเคลื่อนไหวกลุ่ม: {name}',
          viewRank: 'ดูอันดับ',
          wallet: 'กระเป๋าเงิน',
          income: 'รายรับ',
          expense: 'รายจ่าย',
          budgetControl: 'คุมงบประมาณ',
          spent: 'จ่ายไปแล้ว',
          outOf: 'จากทั้งหมด {total}',
          debts: 'ภาระหนี้สิน',
          debtsDesc: 'จัดการภาระหนี้สินรายบัญชี',
          totalDebt: 'หนี้สะสมทั้งหมด',
          premiumBadge: 'ฟีเจอร์พรีเมียม',
          premiumTitle: 'ขอคำปรึกษาจาก AI โค้ชสำหรับแผนหนี้สินและการออม',
          premiumDesc: 'รับคำแนะนำกลยุทธ์ชำระหนี้และการลดหมวดใช้จ่ายฟุ่มเฟือยประเมินรายวัน'
        },
        settings: {
          title: 'ตั้งค่าผู้ใช้งาน',
          lead: 'แก้ไขข้อมูลส่วนตัวและจัดการแผนการเงินของคุณ',
          personalInfo: 'ข้อมูลส่วนตัว',
          displayName: 'ชื่อแสดงผล',
          avatarUrl: 'ลิงก์รูปโปรไฟล์',
          emergencyFund: 'เป้าหมายเงินสำรองฉุกเฉิน (THB)',
          emergencyFundHint: '*ระบบจะประเมินคะแนนโดยแบ่งสัดส่วนเทียบกับรายจ่ายเฉลี่ยประจำเดือนของคุณ*',
          save: 'บันทึกข้อมูลส่วนตัว',
          saveSuccess: 'บันทึกข้อมูลตั้งค่าเรียบร้อยแล้ว!',
          aiSettings: 'ตั้งค่าระบบ AI',
          apiKey: 'API Key สำหรับสแกนใบเสร็จ & AI โค้ช (Bearer Token)',
          apiKeyHint: '*API Key จะถูกเข้ารหัสบันทึกไว้ในเบราว์เซอร์ของคุณเพื่อเรียกใช้งานตรงไปยังเซิร์ฟเวอร์ AI*',
          membership: 'แพ็กเกจสมาชิก',
          currentPackage: 'แพ็กเกจปัจจุบัน',
          upgradeBtn: 'อัปเกรดเป็นพรีเมียม (Beta)',
          lifetimeActive: 'เปิดใช้งานถาวร',
          ocrQuota: 'โควตาสแกนใบเสร็จ OCR วันนี้:',
          disclaimer: 'แอปพลิเคชัน MoneyCircle และคำแนะนำวิเคราะห์ของ AI โค้ชทั้งหมดจัดทำขึ้นเพื่อกระตุ้นและอำนวยความสะดวกในการจดบันทึกรายจ่ายส่วนบุคคลและสร้างวินัยที่ดี ไม่ใช่คำแนะนำทางการเงินที่ได้รับอนุญาตอย่างเป็นทางการ',
          logoutBtn: 'ออกจากระบบ',
          langSelect: 'ภาษาของระบบ (Language)',
          langTh: 'ไทย (Thai)',
          langEn: 'English (English)',
          enterDisplayName: 'กรุณากรอกชื่อแสดงผล',
          themeSelect: 'ธีม / รูปลักษณ์',
          themeLight: 'โหมดสว่าง',
          themeDark: 'โหมดมืด',
          themeSystem: 'ตามระบบ'
        }
      }
    }
  })

  nuxtApp.vueApp.use(i18n)
})
