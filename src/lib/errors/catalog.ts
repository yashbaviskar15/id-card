/**
 * Copy for the app's HTTP error pages, in one place so the real boundaries
 * (`not-found.tsx`, `error.tsx`) and the `/error/[code]` pages all say the same
 * thing. Pure data — safe to import from both server and client components.
 */
export type ErrorKind = 'Client error' | 'Server error';

export interface ErrorCopy {
  code: number;
  kind: ErrorKind;
  title: string;
  description: string;
  hint?: string;
}

export const ERROR_CATALOG: Record<number, ErrorCopy> = {
  400: {
    code: 400,
    kind: 'Client error',
    title: 'Bad request',
    description:
      'The server could not read this request because something in it was malformed or incomplete.',
    hint: 'Check the address and try again, or start over from the home page.',
  },
  401: {
    code: 401,
    kind: 'Client error',
    title: 'Sign in required',
    description: 'You need valid credentials to view this page.',
    hint: 'Sign in again, then retry the link that brought you here.',
  },
  403: {
    code: 403,
    kind: 'Client error',
    title: 'Access denied',
    description: 'You are signed in, but this page is not available to your account.',
    hint: 'If you expect access, check that you opened the link with the right account.',
  },
  404: {
    code: 404,
    kind: 'Client error',
    title: 'Page not found',
    description: 'This link does not point at anything here.',
    hint: 'It may be mistyped, expired, or it never existed.',
  },
  408: {
    code: 408,
    kind: 'Client error',
    title: 'Request timed out',
    description: 'The server waited too long for this request to finish.',
    hint: 'Check your connection and try again.',
  },
  418: {
    code: 418,
    kind: 'Client error',
    title: "I'm a teapot",
    description: 'This server is a teapot, not a coffee machine — there is nothing to brew here.',
    hint: 'An old April Fools’ RFC, kept alive for fun. The page you followed simply does not exist.',
  },
  451: {
    code: 451,
    kind: 'Client error',
    title: 'Unavailable for legal reasons',
    description: 'This content cannot be served here because of a legal restriction.',
    hint: 'If you believe this is a mistake, contact the owner of the link.',
  },
  500: {
    code: 500,
    kind: 'Server error',
    title: 'Something went wrong',
    description: 'An unexpected condition stopped this page from loading.',
    hint: 'Nothing you did caused it. Try again in a moment.',
  },
  502: {
    code: 502,
    kind: 'Server error',
    title: 'Bad gateway',
    description: 'An upstream service returned an invalid response.',
    hint: 'This is usually brief. Try again in a moment.',
  },
  503: {
    code: 503,
    kind: 'Server error',
    title: 'Service unavailable',
    description: 'The service is temporarily overloaded, or down for maintenance.',
    hint: 'Please try again shortly.',
  },
  504: {
    code: 504,
    kind: 'Server error',
    title: 'Gateway timeout',
    description: 'An upstream service did not respond in time.',
    hint: 'Please try again shortly.',
  },
};
