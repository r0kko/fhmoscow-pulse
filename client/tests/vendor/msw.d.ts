declare module 'msw' {
  export interface JsonResolverInfo<RequestBody = unknown> {
    request: {
      json(): Promise<RequestBody>;
    };
  }

  export type HttpResolver<RequestBody = unknown> = (
    info: JsonResolverInfo<RequestBody>
  ) => Response | Promise<Response>;

  export interface HttpResponseShape {
    json<T>(body: T, init?: ResponseInit): Response;
  }

  export type HttpMethod =
    | 'get'
    | 'post'
    | 'put'
    | 'patch'
    | 'delete'
    | 'options';

  export interface HttpHandler {
    method: string;
    matches(url: URL, method: string): boolean;
    resolver: HttpResolver<unknown>;
  }

  export const HttpResponse: HttpResponseShape;

  export const http: Record<
    HttpMethod,
    (path: string | RegExp, resolver: HttpResolver<unknown>) => HttpHandler
  >;
}
