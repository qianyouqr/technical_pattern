import type { Directive, DirectiveBinding } from 'vue'

/**
 * 加载指令
 * v-loading="true"
 */
export const loading: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<boolean>) {
    const value = binding.value

    if (value) {
      el.classList.add('custom-loading')
      const mask = document.createElement('div')
      mask.className = 'custom-loading-mask'
      mask.innerHTML = `
        <div class="custom-loading-spinner">
          <svg class="circular" viewBox="25 25 50 50">
            <circle class="path" cx="50" cy="50" r="20" fill="none"></circle>
          </svg>
        </div>
      `
      el.appendChild(mask)
    }
  },

  updated(el: HTMLElement, binding: DirectiveBinding<boolean>) {
    const value = binding.value
    const mask = el.querySelector('.custom-loading-mask')

    if (value && !mask) {
      el.classList.add('custom-loading')
      const newMask = document.createElement('div')
      newMask.className = 'custom-loading-mask'
      newMask.innerHTML = `
        <div class="custom-loading-spinner">
          <svg class="circular" viewBox="25 25 50 50">
            <circle class="path" cx="50" cy="50" r="20" fill="none"></circle>
          </svg>
        </div>
      `
      el.appendChild(newMask)
    } else if (!value && mask) {
      el.classList.remove('custom-loading')
      mask.remove()
    }
  },

  unmounted(el: HTMLElement) {
    el.classList.remove('custom-loading')
    const mask = el.querySelector('.custom-loading-mask')
    mask?.remove()
  },
}