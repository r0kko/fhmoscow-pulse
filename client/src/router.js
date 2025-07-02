import { createRouter, createWebHistory } from 'vue-router'
import Login from './views/Login.vue'
import Register from './views/Register.vue'
import ProfileWizard from './views/ProfileWizard.vue'
import AwaitingConfirmation from './views/AwaitingConfirmation.vue'
import { auth, fetchCurrentUser, clearAuth } from './auth.js'
import Home from './views/Home.vue'
import Profile from './views/Profile.vue'
import Medical from './views/Medical.vue'
import AdminUsers from './views/AdminUsers.vue'
import AdminHome from './views/AdminHome.vue'
import AdminUserEdit from './views/AdminUserEdit.vue'
import AdminUserCreate from './views/AdminUserCreate.vue'
import AdminMedicalCertificates from './views/AdminMedicalCertificates.vue'
import AdminCampStadiums from './views/AdminCampStadiums.vue'
import AdminCampTrainings from './views/AdminCampTrainings.vue'
import PasswordReset from './views/PasswordReset.vue'
import NotFound from './views/NotFound.vue'
import Forbidden from './views/Forbidden.vue'
import ServerError from './views/ServerError.vue'

const routes = [
  { path: '/', component: Home, meta: { requiresAuth: true } },
  { path: '/profile', component: Profile, meta: { requiresAuth: true } },
  { path: '/medical', component: Medical, meta: { requiresAuth: true } },
  { path: '/admin', component: AdminHome, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/users', component: AdminUsers, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/users/new', component: AdminUserCreate, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/users/:id', component: AdminUserEdit, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/medical-certificates', component: AdminMedicalCertificates, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/camp-stadiums', component: AdminCampStadiums, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/camp-trainings', component: AdminCampTrainings, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/password-reset', component: PasswordReset, meta: { hideLayout: true } },
  { path: '/login', component: Login, meta: { hideLayout: true } },
  { path: '/register', component: Register, meta: { hideLayout: true } },
  { path: '/complete-profile', component: ProfileWizard, meta: { requiresAuth: true } },
  {
    path: '/awaiting-confirmation',
    component: AwaitingConfirmation,
    meta: { requiresAuth: true, hideLayout: true }
  },
  {
    path: '/forbidden',
    component: Forbidden,
    meta: { hideLayout: true }
  },
  {
    path: '/error',
    component: ServerError,
    meta: { hideLayout: true }
  },
  {
    path: '/:pathMatch(.*)*',
    component: NotFound,
    meta: { hideLayout: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, _from, next) => {
  const isAuthenticated = !!auth.token
  const roles = auth.roles
  if (isAuthenticated && !auth.user) {
    try {
      await fetchCurrentUser()
    } catch (_) {
      clearAuth()
      return next('/login')
    }
  }
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresAdmin && !roles.includes('ADMIN')) {
    next('/forbidden')
  } else if (
    isAuthenticated &&
    auth.user?.status &&
    auth.user.status.startsWith('REGISTRATION_STEP') &&
    to.path !== '/complete-profile'
  ) {
    next('/complete-profile')
  } else if (
    isAuthenticated &&
    auth.user?.status === 'AWAITING_CONFIRMATION' &&
    to.path !== '/awaiting-confirmation'
  ) {
    next('/awaiting-confirmation')
  } else {
    next()
  }
})

export default router
