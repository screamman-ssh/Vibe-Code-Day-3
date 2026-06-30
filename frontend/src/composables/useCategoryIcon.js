import {
  Banknote,
  Car,
  Clapperboard,
  CreditCard,
  GraduationCap,
  Heart,
  Home,
  Package,
  PiggyBank,
  Utensils,
  Zap,
} from 'lucide-vue-next'

const CATEGORY_ICONS = {
  Food: Utensils,
  Transport: Car,
  Housing: Home,
  Utilities: Zap,
  Entertainment: Clapperboard,
  Health: Heart,
  Education: GraduationCap,
  'Debt Payment': CreditCard,
  Savings: PiggyBank,
  Income: Banknote,
}

export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || Package
}
