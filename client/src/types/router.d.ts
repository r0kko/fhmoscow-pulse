import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
    requiresAdministrator?: boolean;
    requiresReferee?: boolean;
    requiresStaff?: boolean;
    forbidBrigade?: boolean;
    hideLayout?: boolean;
    fluid?: boolean;
  }
}
