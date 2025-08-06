import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Register from './views/Register.vue';
import ProfileWizard from './views/ProfileWizard.vue';
import AwaitingConfirmation from './views/AwaitingConfirmation.vue';
import { auth, fetchCurrentUser, clearAuth } from './auth.js';
import Home from './views/Home.vue';
import Profile from './views/Profile.vue';
import Medical from './views/Medical.vue';
import Camps from './views/Camps.vue';
import Tasks from './views/Tasks.vue';
import Normatives from './views/Normatives.vue';
import AdminUsers from './views/AdminUsers.vue';
import AdminHome from './views/AdminHome.vue';
import AdminUserEdit from './views/AdminUserEdit.vue';
import AdminUserCreate from './views/AdminUserCreate.vue';
import AdminGrounds from './views/AdminGrounds.vue';
import AdminMedicalManagement from './views/AdminMedicalManagement.vue';
import AdminExamRegistrations from './views/AdminExamRegistrations.vue';
import AdminTrainingRegistrations from './views/AdminTrainingRegistrations.vue';
import AdminDocuments from './views/AdminDocuments.vue';
import AdminNormatives from './views/AdminNormatives.vue';
import Tickets from './views/Tickets.vue';
import AdminTickets from './views/AdminTickets.vue';
import TrainingAttendance from './views/TrainingAttendance.vue';
import PasswordReset from './views/PasswordReset.vue';
import NotFound from './views/NotFound.vue';
import Forbidden from './views/Forbidden.vue';
import ServerError from './views/ServerError.vue';

const routes = [
  { path: '/', component: Home, meta: { requiresAuth: true, fluid: true } },
  { path: '/profile', component: Profile, meta: { requiresAuth: true } },
  {
    path: '/medical',
    component: Medical,
    meta: { requiresAuth: true, requiresReferee: true },
  },
  {
    path: '/camps',
    component: Camps,
    meta: { requiresAuth: true, requiresReferee: true },
  },
  {
    path: '/tickets',
    component: Tickets,
    meta: { requiresAuth: true, requiresReferee: true },
  },
  {
    path: '/tasks',
    component: Tasks,
    meta: { requiresAuth: true },
  },
  {
    path: '/normatives',
    component: Normatives,
    meta: { requiresAuth: true, requiresReferee: true },
  },
  {
    path: '/trainings/:id/attendance',
    component: TrainingAttendance,
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    component: AdminHome,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/users',
    component: AdminUsers,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/users/new',
    component: AdminUserCreate,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/users/:id',
    component: AdminUserEdit,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/medical',
    component: AdminMedicalManagement,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/documents',
    component: AdminDocuments,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/normatives',
    component: AdminNormatives,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/tickets',
    component: AdminTickets,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/medical-exams/:id/registrations',
    component: AdminExamRegistrations,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/camp-trainings/:id/registrations',
    component: AdminTrainingRegistrations,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/grounds',
    component: AdminGrounds,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/referee-groups',
    redirect: { path: '/admin/grounds', query: { tab: 'groups' } },
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/password-reset',
    component: PasswordReset,
    meta: { hideLayout: true },
  },
  { path: '/login', component: Login, meta: { hideLayout: true } },
  { path: '/register', component: Register, meta: { hideLayout: true } },
  {
    path: '/complete-profile',
    component: ProfileWizard,
    meta: { requiresAuth: true },
  },
  {
    path: '/awaiting-confirmation',
    component: AwaitingConfirmation,
    meta: { requiresAuth: true, hideLayout: true },
  },
  {
    path: '/forbidden',
    component: Forbidden,
    meta: { hideLayout: true },
  },
  {
    path: '/error',
    component: ServerError,
    meta: { hideLayout: true },
  },
  {
    path: '/:pathMatch(.*)*',
    component: NotFound,
    meta: { hideLayout: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, _from, next) => {
  const isAuthenticated = !!auth.token;
  const roles = auth.roles;
  if (isAuthenticated && !auth.user) {
    try {
      await fetchCurrentUser();
    } catch (_) {
      clearAuth();
      return next('/login');
    }
  }
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresAdmin && !roles.includes('ADMIN')) {
    next('/forbidden');
  } else if (to.meta.requiresReferee && !roles.includes('REFEREE')) {
    next('/forbidden');
  } else if (
    isAuthenticated &&
    auth.user?.status &&
    auth.user.status.startsWith('REGISTRATION_STEP') &&
    to.path !== '/complete-profile'
  ) {
    next('/complete-profile');
  } else if (
    isAuthenticated &&
    auth.user?.status === 'AWAITING_CONFIRMATION' &&
    to.path !== '/awaiting-confirmation'
  ) {
    next('/awaiting-confirmation');
  } else {
    next();
  }
});

export default router;
