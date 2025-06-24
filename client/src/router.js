import { createRouter, createWebHistory } from 'vue-router'
import Login from './views/Login.vue'
import Register from './views/Register.vue'
import ProfileWizard from './views/ProfileWizard.vue'
import Home from './views/Home.vue'
import Profile from './views/Profile.vue'
import AdminUsers from './views/AdminUsers.vue'
import AdminHome from './views/AdminHome.vue'
import AdminUserEdit from './views/AdminUserEdit.vue'
import AdminUserCreate from './views/AdminUserCreate.vue'

const routes = [
  { path: '/', component: Home, meta: { requiresAuth: true } },
  { path: '/profile', component: Profile, meta: { requiresAuth: true } },
  { path: '/admin', component: AdminHome, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/users', component: AdminUsers, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/users/new', component: AdminUserCreate, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/users/:id', component: AdminUserEdit, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/complete-profile', component: ProfileWizard, meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const isAuthenticated = !!localStorage.getItem('access_token')
  const roles = JSON.parse(localStorage.getItem('roles') || '[]')
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresAdmin && !roles.includes('ADMIN')) {
    next('/')
  } else {
    next()
  }
})

export default router
