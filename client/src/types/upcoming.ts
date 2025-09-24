export type UpcomingEventType = 'training' | 'exam' | 'event';

export interface UpcomingCardEvent {
  type: UpcomingEventType;
  title: string;
  description: string;
  startAt: string;
  link?: string | null;
  isOnline?: boolean;
}

export interface UpcomingListItem extends UpcomingCardEvent {
  id: string | number;
}
