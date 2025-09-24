import {
  createRouter,
  createWebHistory,
  type NavigationGuardNext,
  type RouteRecordRaw,
} from 'vue-router';
import Login from './views/Login.vue';
import Register from './views/Register.vue';
import ProfileWizard from './views/ProfileWizard.vue';
import AwaitingConfirmation from './views/AwaitingConfirmation.vue';
import { auth, clearAuth, fetchCurrentUser } from './auth';
import Home from './views/Home.vue';
import Profile from './views/Profile.vue';
import DocumentView from './views/DocumentView.vue';
import Documents from './views/Documents.vue';
import Medical from './views/Medical.vue';
import Camps from './views/Camps.vue';
import Tasks from './views/Tasks.vue';
import Availability from './views/Availability.vue';
import Normatives from './views/Normatives.vue';
import AdminUsers from './views/AdminUsers.vue';
import AdminHome from './views/AdminHome.vue';
import AdminUserEdit from './views/AdminUserEdit.vue';
import AdminUserCreate from './views/AdminUserCreate.vue';
import AdminGrounds from './views/AdminGrounds.vue';
import SchoolGrounds from './views/SchoolGrounds.vue';
import AdminClubsTeams from './views/AdminClubsTeams.vue';
import AdminSportSchools from './views/AdminSportSchools.vue';
import AdminTournaments from './views/AdminTournaments.vue';
import SchoolMatches from './views/SchoolMatches.vue';
import SchoolPastMatches from './views/SchoolPastMatches.vue';
import SchoolMatchAgreements from './views/SchoolMatchAgreements.vue';
import SchoolMatch from './views/SchoolMatch.vue';
import SchoolMatchLineups from './views/SchoolMatchLineups.vue';
import SchoolMatchReferees from './views/SchoolMatchReferees.vue';
import SchoolMatchAppeals from './views/SchoolMatchAppeals.vue';
import SchoolPlayers from './views/SchoolPlayers.vue';
import SchoolPlayersRoster from './views/SchoolPlayersRoster.vue';
import SchoolPlayerPhotos from './views/SchoolPlayerPhotos.vue';
import SchoolHome from './views/SchoolHome.vue';
import AdminCamps from './views/AdminCamps.vue';
import AdminMedicalManagement from './views/AdminMedicalManagement.vue';
import AdminExamRegistrations from './views/AdminExamRegistrations.vue';
import AdminTrainingRegistrations from './views/AdminTrainingRegistrations.vue';
import AdminCourseTrainingRegistrations from './views/AdminCourseTrainingRegistrations.vue';
import AdminDocuments from './views/AdminDocuments.vue';
import AdminNormatives from './views/AdminNormatives.vue';
import Tickets from './views/Tickets.vue';
import AdminTickets from './views/AdminTickets.vue';
import AdminPlayerPhotoRequests from './views/AdminPlayerPhotoRequests.vue';
import TrainingAttendance from './views/TrainingAttendance.vue';
import AdminCourses from './views/AdminCourses.vue';
import AdminRefereeAvailability from './views/AdminRefereeAvailability.vue';
import AdminSportsCalendar from './views/AdminSportsCalendar.vue';
import AdminMatch from './views/AdminMatch.vue';
import AdminSystemOps from './views/AdminSystemOps.vue';
import AdminEquipment from './views/AdminEquipment.vue';
import Qualification from './views/Qualification.vue';
import PasswordReset from './views/PasswordReset.vue';
import ChangePassword from './views/ChangePassword.vue';
import NotFound from './views/NotFound.vue';
import Forbidden from './views/Forbidden.vue';
import ServerError from './views/ServerError.vue';
import Verify from './views/Verify.vue';

import {
  ADMIN_ROLES as adminRoles,
  REFEREE_ROLES as refereeRoles,
  STAFF_ROLES as staffRoles,
} from './utils/roles';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Home,
    meta: { requiresAuth: true, fluid: true, title: 'Главная' },
  },
  {
    path: '/admin/equipment',
    component: AdminEquipment,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Экипировка' },
  },
  {
    path: '/verify',
    component: Verify,
    meta: { hideLayout: true, title: 'Проверка документа' },
  },
  {
    path: '/school',
    component: SchoolHome,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Управление спортивной школой',
    },
  },
  {
    path: '/admin/sports-calendar',
    component: AdminSportsCalendar,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Календарь игр' },
  },
  {
    path: '/admin/matches/:id',
    component: AdminMatch,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Матч' },
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
    meta: {
      requiresAuth: true,
      requiresReferee: true,
      forbidBrigade: true,
      title: 'Медосмотр',
    },
  },
  {
    path: '/camps',
    component: Camps,
    meta: {
      requiresAuth: true,
      requiresReferee: true,
      forbidBrigade: true,
      title: 'Сборы',
    },
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
    path: '/availability',
    component: Availability,
    meta: { requiresAuth: true, requiresReferee: true, title: 'Моя занятость' },
  },
  {
    path: '/normatives',
    component: Normatives,
    meta: {
      requiresAuth: true,
      requiresReferee: true,
      forbidBrigade: true,
      title: 'Нормативы',
    },
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
    path: '/admin/system-ops',
    component: AdminSystemOps,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Синхронизация' },
  },
  {
    path: '/admin/player-photo-requests',
    component: AdminPlayerPhotoRequests,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      title: 'Фото игроков',
    },
  },
  {
    path: '/admin/referee-availability',
    component: AdminRefereeAvailability,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      title: 'Занятость судей',
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
    path: '/admin/signature-types',
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
    path: '/admin/teams',
    redirect: { path: '/admin/clubs-teams' },
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/clubs',
    redirect: { path: '/admin/clubs-teams' },
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/clubs-teams',
    component: AdminClubsTeams,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Команды и клубы' },
  },
  {
    path: '/admin/tournaments',
    component: AdminTournaments,
    meta: { requiresAuth: true, requiresAdmin: true, title: 'Турниры' },
  },
  {
    path: '/admin/sport-schools',
    component: AdminSportSchools,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      requiresAdministrator: true,
      title: 'Управление спортивными школами',
    },
  },
  {
    path: '/school-matches',
    component: SchoolMatches,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Управление матчами школы',
    },
  },
  {
    path: '/school-matches/:id',
    component: SchoolMatch,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Матч школы',
    },
  },
  {
    path: '/school-matches/:id/agreements',
    component: SchoolMatchAgreements,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Время и место',
    },
  },
  {
    path: '/school-matches/:id/lineups',
    component: SchoolMatchLineups,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Составы на матч',
    },
  },
  {
    path: '/school-matches/:id/referees',
    component: SchoolMatchReferees,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Судьи матча',
    },
  },
  {
    path: '/school-matches/:id/appeals',
    component: SchoolMatchAppeals,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Обращения по матчу',
    },
  },
  {
    path: '/school-matches/past',
    component: SchoolPastMatches,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Прошедшие матчи школы',
    },
  },
  {
    path: '/school-players',
    component: SchoolPlayers,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Команды и составы',
    },
  },
  {
    path: '/school-players/photos',
    component: SchoolPlayerPhotos,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Фотографии игроков',
    },
  },
  {
    path: '/school-grounds',
    component: SchoolGrounds,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Стадионы',
    },
  },
  {
    path: '/school-players/season/:seasonId/year/:year',
    component: SchoolPlayersRoster,
    meta: {
      requiresAuth: true,
      requiresStaff: true,
      title: 'Состав команды',
    },
  },
  {
    path: '/admin/clubs-teams/season/:seasonId/year/:year',
    component: SchoolPlayersRoster,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      title: 'Состав команды',
    },
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
    path: '/change-password',
    component: ChangePassword,
    meta: { requiresAuth: true, hideLayout: true, title: 'Смена пароля' },
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
  scrollBehavior(_to, _from, savedPosition) {
    // Restore saved position (back/forward) or scroll to top
    if (savedPosition) return savedPosition;
    return { top: 0 };
  },
});

router.beforeEach(async (to, _from, next: NavigationGuardNext) => {
  const isAuthenticated = Boolean(auth.token);
  const roles = auth.roles;
  const isBrigadeOnly =
    roles.includes('BRIGADE_REFEREE') && !roles.includes('REFEREE');
  if (isAuthenticated && !auth.user) {
    try {
      await fetchCurrentUser();
    } catch {
      clearAuth();
      return next('/login');
    }
  }
  const meta = to.meta;

  if (meta.requiresAuth && !isAuthenticated) {
    next('/login');
  } else if (
    isAuthenticated &&
    auth.mustChangePassword &&
    to.path !== '/change-password'
  ) {
    next('/change-password');
  } else if (meta.requiresAdmin && !roles.some((r) => adminRoles.includes(r))) {
    next('/forbidden');
  } else if (meta.requiresAdministrator && !roles.includes('ADMIN')) {
    next('/forbidden');
  } else if (
    meta.requiresReferee &&
    !roles.some((r) => refereeRoles.includes(r))
  ) {
    next('/forbidden');
  } else if (meta.forbidBrigade && isBrigadeOnly) {
    next('/forbidden');
  } else if (
    meta.requiresStaff &&
    !roles.some((r) => staffRoles.includes(r) || adminRoles.includes(r))
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
    const meta = to.meta;
    document.title =
      meta.title && meta.title.length > 0 ? `${meta.title} — ${base}` : base;
    // Move focus to <main> for screen reader users after route change
    // Use rAF to ensure the view is rendered
    requestAnimationFrame(() => {
      const el = document.getElementById('main');
      if (el && typeof el.focus === 'function') el.focus();
    });
  }
});

export default router;
