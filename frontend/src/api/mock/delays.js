export function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function ocrDelay() {
  return delay(1500)
}
