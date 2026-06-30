export function formatTHB(amount) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function tierColor(tier) {
  const map = {
    'At Risk': 'bg-red-100 text-red-700 border-red-200',
    Building: 'bg-amber-100 text-amber-700 border-amber-200',
    Steady: 'bg-blue-100 text-blue-700 border-blue-200',
    Thriving: 'bg-green-100 text-green-700 border-green-200',
  }
  return map[tier] || map.Building
}
