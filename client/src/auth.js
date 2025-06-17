import { reactive } from 'vue'
import { apiFetch } from './api.js'

export const auth = reactive({
  user: null,
  roles: []
})

export async function fetchCurrentUser() {
  const data = await apiFetch('/auth/me')
  auth.user = data.user
  auth.roles = data.roles || []
  localStorage.setItem('roles', JSON.stringify(auth.roles))
}

export function clearAuth() {
  auth.user = null
  auth.roles = []
  localStorage.removeItem('roles')
}
