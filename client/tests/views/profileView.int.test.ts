import { render, screen, within } from '@testing-library/vue';
import {
  createMemoryHistory,
  createRouter,
  type RouteRecordRaw,
  type Router,
} from 'vue-router';
import { http, HttpResponse } from 'msw';
import { defineComponent, h } from 'vue';
import type { ComponentObjectPropsOptions } from 'vue';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ProfileView from '../../src/views/Profile.vue';
import { auth, type AuthUser } from '../../src/auth';
import { setupMsw } from '../utils/msw';

/* eslint-disable vue/one-component-per-file */

const server = setupMsw();

interface ExposeStubOptions {
  props?: ComponentObjectPropsOptions;
  emits?: string[];
}

function createExposeStub(
  name: string,
  { props = {}, emits = [] }: ExposeStubOptions = {}
) {
  const normalizedProps = (props ?? {}) as ComponentObjectPropsOptions;
  const normalizedEmits = emits ?? [];
  return defineComponent({
    name,
    props: normalizedProps,
    emits: normalizedEmits,
    setup(
      _props: Record<string, unknown>,
      { expose }: { expose: (payload: { open: () => void }) => void }
    ) {
      expose({ open: () => {} });
      return () => h('div', { 'data-testid': name });
    },
  });
}

const routes: RouteRecordRaw[] = [
  { path: '/', component: { template: '<div>home</div>' } },
  { path: '/profile', component: ProfileView },
  { path: '/profile/doc/:slug', component: { template: '<div />' } },
];

function createRouterInstance(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

describe('Profile View (integration)', () => {
  beforeEach(() => {
    auth.roles = ['REFEREE'];
    const user: AuthUser = { id: 99, phone: '79991234567' };
    auth.user = user;

    server.use(
      http.get('*/users/me', () =>
        HttpResponse.json({
          user: {
            id: 99,
            first_name: 'Анна',
            last_name: 'Иванова',
            phone: '79991234567',
            email: 'anna@example.ru',
            email_confirmed: false,
          },
        })
      ),
      http.get('*/passports/me', () =>
        HttpResponse.json({
          passport: { series: '45 67', number: '1234567890' },
        })
      ),
      http.get('*/inns/me', () =>
        HttpResponse.json({ inn: { number: '500100732259' } })
      ),
      http.get('*/taxations/me', () =>
        HttpResponse.json({ taxation: { status: 'RESIDENT' } })
      ),
      http.get('*/snils/me', () =>
        HttpResponse.json({ snils: { number: '112-233-445 95' } })
      ),
      http.get('*/sign-types/me', () =>
        HttpResponse.json({ signType: { alias: 'SIMPLE_ELECTRONIC' } })
      ),
      http.get('*/bank-accounts/me', () =>
        HttpResponse.json({
          account: {
            number: '40702810900000012345',
            bank_name: 'ПАО Банк',
          },
        })
      ),
      http.get('*/addresses/REGISTRATION', () =>
        HttpResponse.json({
          address: {
            postal_code: '123456',
            result: 'г. Москва, ул. Ленина, д. 1',
          },
        })
      ),
      http.get('*/addresses/RESIDENCE', () =>
        HttpResponse.json({
          address: {
            postal_code: '654321',
            result: 'г. Москва, пр-т Мира, д. 5',
          },
        })
      ),
      http.get('*/vehicles/me', () =>
        HttpResponse.json({
          vehicles: [
            {
              id: 'veh-1',
              brand: 'Hyundai',
              model: 'Sonata',
              number: 'А123ВС77',
              is_active: true,
            },
          ],
        })
      )
    );
  });

  afterEach(() => {
    auth.roles = [];
    auth.user = null;
  });

  it('renders personal data, banking details, addresses and vehicles', async () => {
    const router = createRouterInstance();
    router.push('/profile');
    await router.isReady();

    const InfoFieldStub = defineComponent({
      props: {
        id: { type: String, required: true },
        label: { type: String, required: true },
        value: { type: [String, Number], default: '' },
        placeholder: { type: String, default: '—' },
        multiline: { type: Boolean, default: false },
      },
      setup(props) {
        return () =>
          h('div', { class: 'info-field-stub' }, [
            h('label', { for: props.id }, props.label),
            props.multiline
              ? h('textarea', {
                  id: props.id,
                  readonly: true,
                  value: props.value || props.placeholder,
                })
              : h('input', {
                  id: props.id,
                  readonly: true,
                  value: props.value || props.placeholder,
                }),
          ]);
      },
    });

    render(ProfileView, {
      global: {
        plugins: [router],
        stubs: {
          InfoField: InfoFieldStub,
          AddVehicleModal: createExposeStub('AddVehicleModal', {
            emits: ['saved'],
          }),
          ChangeBankRequisitesModal: createExposeStub('ChangeBankModal', {
            emits: ['created'],
          }),
          DocumentSignModal: createExposeStub('DocumentSignModal', {
            props: { userEmail: { type: String, default: '' } },
            emits: ['signed'],
          }),
        },
      },
    });

    await screen.findByRole('heading', { name: 'Документы и данные' });

    expect(await screen.findByLabelText('Телефон')).toHaveValue(
      '+7 (999) 123-45-67'
    );
    expect(await screen.findByText('45 67 1********0')).toBeInTheDocument();
    expect(await screen.findByText('500100732259')).toBeInTheDocument();
    expect(await screen.findByText('112-233-445 95')).toBeInTheDocument();

    await screen.findByRole('heading', { name: 'Банковские реквизиты' });
    expect(await screen.findByLabelText('Счёт')).toHaveValue('···· 2345');
    expect(await screen.findByLabelText('Банк')).toHaveValue('ПАО Банк');
    expect(
      screen.getByRole('button', { name: 'Изменить банковские реквизиты' })
    ).toBeInTheDocument();

    expect(
      await screen.findByDisplayValue('123456, г. Москва, ул. Ленина, д. 1')
    ).toBeInTheDocument();
    expect(
      await screen.findByDisplayValue('654321, г. Москва, пр-т Мира, д. 5')
    ).toBeInTheDocument();

    expect(
      await screen.findByRole('button', {
        name: 'Добавить транспортное средство',
      })
    ).toBeInTheDocument();
    const vehicleRow = await screen.findByText(
      (content) => content.includes('Hyundai') && content.includes('А123ВС77')
    );
    expect(vehicleRow).toHaveTextContent('Hyundai Sonata · А123ВС77');

    const nav = screen
      .getAllByRole('navigation', { hidden: true })
      .find((element) => element.classList.contains('profile-nav'));
    if (!nav) throw new Error('Profile navigation not found');
    expect(within(nav).getByText('Документы')).toBeInTheDocument();
    expect(within(nav).getByText('Банк')).toBeInTheDocument();
    expect(within(nav).getByText('Адреса')).toBeInTheDocument();

    expect(
      await screen.findByRole('button', { name: 'Отправить код' })
    ).toBeInTheDocument();
  });
});

/* eslint-enable vue/one-component-per-file */
