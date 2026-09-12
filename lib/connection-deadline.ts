export class DatabaseConnectionError extends Error {
  constructor(cause?: unknown) {
    super('Database connection is unavailable.', { cause });
    this.name = 'DatabaseConnectionError';
  }
}

// The driver's server-selection timeout may not cover the initial SRV lookup.
export async function connectionDeadline<T>(connection: Promise<T>, milliseconds = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([connection, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new DatabaseConnectionError()), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export function databaseConnectionMessage() {
  return process.env.NODE_ENV === 'development'
    ? 'Could not connect to MongoDB. In Atlas, check that your current IP is active in Network Access, the cluster is running, and your database credentials are correct. Then retry.'
    : 'Account access is temporarily unavailable. Please try again shortly.';
}
