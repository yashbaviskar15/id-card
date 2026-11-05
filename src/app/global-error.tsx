'use client';

/**
 * Last-resort boundary: only reached when the root layout itself fails, so it has
 * to render its own <html> and <body>. Styling is inlined because the stylesheet
 * may be exactly what failed to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          color: '#111827',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Helvetica Neue, Arial, sans-serif',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: '360px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#5b6472', lineHeight: 1.5 }}>
            The application could not start. If this is a fresh deployment, check that every required
            environment variable is set — see SETUP.md.
          </p>
          {error.digest ? (
            <p style={{ marginTop: '16px', fontSize: '12px', color: '#5b6472' }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '24px',
              width: '100%',
              height: '44px',
              borderRadius: '10px',
              border: '1px solid #111827',
              background: '#111827',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
