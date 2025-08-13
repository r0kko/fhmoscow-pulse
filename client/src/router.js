import { createRouter, createWebHistory } from 'vue-router';
import Login from './views/Login.vue';
import Register from './views/Register.vue';
import ProfileWizard from './views/ProfileWizard.vue';
import AwaitingConfirmation from './views/AwaitingConfirmation.vue';
import { auth, clearAuth, fetchCurrentUser } from './auth.js';
import Home from './views/Home.vue';
import Profile from './views/Profile.vue';
import DocumentView from './views/DocumentView.vue';
import Documents from './views/Documents.vue';
import Medical from './views/Medical.vue';
import Camps from './views/Camps.vue';
import Tasks from './views/Tasks.vue';
import Normatives from './views/Normatives.vue';
import AdminUsers from './views/AdminUsers.vue';
import AdminHome from './views/AdminHome.vue';
import AdminUserEdit from './views/AdminUserEdit.vue';
import AdminUserCreate from './views/AdminUserCreate.vue';
import AdminGrounds from './views/AdminGrounds.vue';
import AdminCamps from './views/AdminCamps.vue';
import AdminMedicalManagement from './views/AdminMedicalManagement.vue';
import AdminExamRegistrations from './views/AdminExamRegistrations.vue';
import AdminTrainingRegistrations from './views/AdminTrainingRegistrations.vue';
import AdminCourseTrainingRegistrations from './views/AdminCourseTrainingRegistrations.vue';
import AdminDocuments from './views/AdminDocuments.vue';
import AdminNormatives from './views/AdminNormatives.vue';
import Tickets from './views/Tickets.vue';
import AdminTickets from './views/AdminTickets.vue';
import TrainingAttendance from './views/TrainingAttendance.vue';
import AdminCourses from './views/AdminCourses.vue';
import Qualification from './views/Qualification.vue';
import PasswordReset from './views/PasswordReset.vue';
import NotFound from './views/NotFound.vue';
import Forbidden from './views/Forbidden.vue';
import ServerError from './views/ServerError.vue';

const adminRoles = [
  'ADMIN',
  'FIELD_REFEREE_SPECIALIST',
  'BRIGADE_REFEREE_SPECIALIST',
];
const refereeRoles = ['REFEREE', 'BRIGADE_REFEREE'];

const routes = [
  {
    path: '/',
    component: Home,
    meta: { requiresAuth: true, fluid: true, title: 'Главная' },
  },
  {
    path: '/profile',
    component: Profile,
    meta: { requiresAuth: true, title: 'Мои данные' },
  },
  {
    path: '/profile/doc/:type',
    component: DocumentView,
    meta: { requiresAuth: true, title: 'Документ' },
  },
  {
    path: '/documents',
    component: Documents,
    meta: { requiresAuth: true, title: 'Документы' },
  },
  {
    path: '/medical',
    component: Medical,
    meta: { requiresAuth: true, requiresReferee: true, title: 'Медосмотр' },
  },
  {
    path: '/camps',
    component: Camps,
    meta: { requiresAuth: true, requiresReferee: true, title: 'Сборы' },
  },
  {
    path: '/tickets',
    component: Tickets,
    meta: { requiresAuth: true, requiresReferee: true, title: 'Обращения' },
  },
  {
    path: '/tasks',
    component: Tasks,
    meta: { requiresAuth: true, title: 'Задачи' },
  },
  {
    path: '/normatives',
    component: Normatives,
    meta: { requiresAuth: true, requiresReferee: true, title: 'Нормативы' },
  },
  {
    path: '/qualification',
    component: Qualification,
    meta: { requiresAuth: true, title: 'Повышение квалификации' },
  },
  {
    path: '/trainings/:id/attendance',
    component: TrainingAttendance,
    meta: { requiresAuth: true, title: 'Посещение тренировки' },
  },
  {
    path: '/admin',
    component: AdminHome,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      title: 'Администрирование',
    },
  },
  {
    path: '/admin/users',
    component: AdminUsers,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Пользователи' },
  },
  {
    path: '/admin/users/new',
    component: AdminUserCreate,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      title: 'Новый пользователь',
    },
  },
  {
    path: '/admin/users/:id',
    component: AdminUserEdit,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      title: 'Редактирование пользователя',
    },
  },
  {
    path: '/admin/medical',
    component: AdminMedicalManagement,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Медицина' },
  },
  {
    path: '/admin/documents',
    component: AdminDocuments,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Документы' },
  },
  {
    path: '/admin/documents-signatures',
    redirect: { path: '/admin/documents', query: { tab: 'signatures' } },
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/courses',
    component: AdminCourses,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Мероприятия' },
  },
  {
    path: '/admin/normatives',
    component: AdminNormatives,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Нормативы' },
  },
  {
    path: '/admin/tickets',
    component: AdminTickets,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Обращения' },
  },
  {
    path: '/admin/medical-exams/:id/registrations',
    component: AdminExamRegistrations,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      title: 'Заявки на медосмотр',
    },
  },
  {
    path: '/admin/camp-trainings/:id/registrations',
    component: AdminTrainingRegistrations,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      title: 'Участники тренировки',
    },
  },
  {
    path: '/admin/course-trainings/:id/registrations',
    component: AdminCourseTrainingRegistrations,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      title: 'Участники занятия',
    },
  },
  {
    path: '/admin/camps',
    component: AdminCamps,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Сборы' },
  },
  {
    path: '/admin/grounds',
    component: AdminGrounds,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Площадки' },
  },
  {
    path: '/admin/referee-groups',
    redirect: { path: '/admin/camps', query: { tab: 'groups' } },
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/password-reset',
    component: PasswordReset,
    meta: { hideLayout: true },
  },
  {
    path: '/login',
    component: Login,
    meta: { hideLayout: true, title: 'Вход' },
  },
  {
    path: '/register',
    component: Register,
    meta: { hideLayout: true, title: 'Регистрация' },
  },
  {
    path: '/complete-profile',
    component: ProfileWizard,
    meta: { requiresAuth: true, title: 'Заполнение профиля' },
  },
  {
    path: '/awaiting-confirmation',
    component: AwaitingConfirmation,
    meta: { requiresAuth: true, hideLayout: true, title: 'Подтверждение' },
  },
  {
    path: '/forbidden',
    component: Forbidden,
    meta: { hideLayout: true, title: 'Доступ запрещён' },
  },
  {
    path: '/error',
    component: ServerError,
    meta: { hideLayout: true, title: 'Ошибка' },
  },
  {
    path: '/:pathMatch(.*)*',
    component: NotFound,
    meta: { hideLayout: true, title: 'Страница не найдена' },
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
  } else if (
    to.meta.requiresAdmin &&
    !roles.some((r) => adminRoles.includes(r))
  ) {
    next('/forbidden');
  } else if (
    to.meta.requiresReferee &&
    !roles.some((r) => refereeRoles.includes(r))
  ) {
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

router.afterEach((to) => {
  if (typeof document !== 'undefined') {
    const base = 'Пульс';
    document.title =
      to.meta && to.meta.title ? `${to.meta.title} — ${base}` : base;
  }
});

export default router;
