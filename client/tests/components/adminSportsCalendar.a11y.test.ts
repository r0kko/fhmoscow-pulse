import { fireEvent, render, screen, within } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import TabSelector from '@/components/TabSelector.vue';
import MatchesDayTiles from '@/components/MatchesDayTiles.vue';
import edgeFade from '@/utils/edgeFade';

describe('Admin sports calendar accessibility', () => {
  it('supports keyboard tablist navigation with Arrow/Home/End', async () => {
    render(
      {
        components: { TabSelector },
        data() {
          return {
            current: 'a',
            tabs: [
              { key: 'a', label: 'Первый' },
              { key: 'b', label: 'Второй', disabled: true },
              { key: 'c', label: 'Третий' },
            ],
          };
        },
        template: `
        <TabSelector
          v-model="current"
          :tabs="tabs"
          aria-label="Тестовые вкладки"
          :nav-fill="false"
          justify="start"
        />
      `,
      },
      {
        global: {
          directives: {
            'edge-fade': edgeFade,
          },
        },
      }
    );

    const first = screen.getByRole('tab', { name: /Первый/i });
    const third = screen.getByRole('tab', { name: /Третий/i });
    expect(first).toHaveAttribute('aria-selected', 'true');

    first.focus();
    await fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(third).toHaveAttribute('aria-selected', 'true');

    await fireEvent.keyDown(third, { key: 'Home' });
    expect(first).toHaveAttribute('aria-selected', 'true');

    await fireEvent.keyDown(first, { key: 'End' });
    expect(third).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps exactly one interactive target per match row', async () => {
    const { container } = render(MatchesDayTiles, {
      props: {
        items: [
          {
            id: 'm-1',
            date: '2030-01-01T12:00:00Z',
            team1: 'Спартак',
            team2: 'Динамо',
            home_club: 'Клуб А',
            away_club: 'Клуб Б',
            stadium: 'Арена 1',
            tournament: 'Кубок',
            group: 'Группа 1',
            tour: '1 тур',
            agreement_accepted: false,
            agreement_pending: true,
            urgent_unagreed: true,
            needs_attention: true,
            agreements_allowed: true,
            status: { alias: 'SCHEDULED', name: 'Назначен' },
          },
        ],
        showActions: true,
        showDayHeader: false,
        noScroll: true,
        detailsBase: '/admin/matches',
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template:
              "<a :href=\"typeof to === 'string' ? to : (to?.path || '#')\"></a>",
          },
        },
      },
    });

    const row = container.querySelector('.match-row');
    expect(row).not.toBeNull();
    const links = within(row as HTMLElement).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      'aria-label',
      'Открыть матч Спартак — Динамо'
    );
    expect(
      (row as HTMLElement).querySelectorAll(
        '.col-actions a, .col-actions button'
      )
    ).toHaveLength(0);
    expect(
      (row as HTMLElement).querySelector('.col-actions [aria-hidden="true"]')
    ).not.toBeNull();
  });
});
