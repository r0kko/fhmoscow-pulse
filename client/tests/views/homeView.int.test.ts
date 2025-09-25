import { render, screen, within } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeView from '@/views/Home.vue';
import edgeFade from '@/utils/edgeFade';
import { auth, type AuthUser } from '@/auth';
import { setupMsw } from '../utils/msw';

const server = setupMsw();

function resetAuth() {
  auth.user = null;
  auth.roles = [];
  auth.token = null;
  auth.mustChangePassword = false;
}

const routes: RouteRecordRaw[] = [
  { path: '/', component: HomeView },
  { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

describe('Home View (integration)', () => {
  beforeEach(() => {
    resetAuth();
    const user: AuthUser = {
      id: 42,
      first_name: 'Анна',
      phone: '79991234567',
    };
    auth.user = user;
    auth.roles = ['REFEREE', 'SPORT_SCHOOL_STAFF'];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T06:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAuth();
  });

  it('surfaces personalized dashboard tiles and upcoming schedule data', async () => {
    server.use(
      http.get('*/courses/me', () =>
        HttpResponse.json({ course: { id: 7, title: 'Подготовка к сезону' } })
      ),
      http.get('*/users/me/sport-schools', () =>
        HttpResponse.json({ has_club: true, has_team: false })
      ),
      http.get('*/camp-trainings/me/upcoming', () =>
        HttpResponse.json({
          trainings: [
            {
              id: 'train-1',
              start_at: '2024-05-05T12:00:00+03:00',
              ground: {
                address: { result: 'Ледовый дворец, 1' },
                yandex_url: 'https://maps.yandex.ru/train-1',
              },
            },
          ],
        })
      ),
      http.get('*/medical-exams/me/upcoming', () =>
        HttpResponse.json({
          exams: [
            {
              id: 'exam-2',
              start_at: '2024-05-03T09:00:00+03:00',
              registration_status: 'APPROVED',
              center: { address: { result: 'Клиника №2' } },
            },
          ],
        })
      ),
      http.get('*/course-trainings/me/upcoming', () =>
        HttpResponse.json({
          trainings: [
            {
              id: 'course-3',
              start_at: '2024-05-04T10:00:00+03:00',
              type: { online: true },
              url: 'lk.fhmoscow.com/webinar',
            },
          ],
        })
      )
    );

    const router = createRouterInstance();
    router.push('/?notice=Профиль обновлён');
    await router.isReady();

    render(HomeView, {
      global: {
        plugins: [router],
        directives: {
          'edge-fade': edgeFade,
        },
      },
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Профиль обновлён'
    );

    const upcomingList = await screen.findByLabelText(
      'Список ближайших событий'
    );
    expect(within(upcomingList).getByText('Медосмотр')).toBeInTheDocument();
    expect(within(upcomingList).getByText('Мероприятие')).toBeInTheDocument();
    expect(within(upcomingList).getByText('Тренировка')).toBeInTheDocument();

    expect(screen.queryByLabelText('Загрузка ближайших событий')).toBeNull();

    expect(screen.getByRole('link', { name: 'Семинары' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Команды и составы' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Фотографии игроков' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Профиль' })).toBeInTheDocument();
  });

  it('shows a focused layout for FHMO staff roles', async () => {
    auth.roles = ['FHMO_MEDIA_SMM_MANAGER'];

    const router = createRouterInstance();
    router.push('/');
    await router.isReady();

    render(HomeView, {
      global: {
        plugins: [router],
        directives: {
          'edge-fade': edgeFade,
        },
      },
    });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Работаем поэтапно' })
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Сейчас для вас');
    expect(
      screen.queryByLabelText('Список ближайших событий')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Обращения' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Профиль' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Семинары' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Команды и составы' })).toBeNull();
  });

  it('offers direct admin access for FHMO content moderators', async () => {
    auth.roles = ['FHMO_MEDIA_CONTENT_MODERATOR'];

    const router = createRouterInstance();
    router.push('/');
    await router.isReady();

    render(HomeView, {
      global: {
        plugins: [router],
        directives: {
          'edge-fade': edgeFade,
        },
      },
    });

    expect(
      screen.getByRole('link', { name: 'Администрирование' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Команды и составы' })
    ).not.toBeInTheDocument();
  });
});
