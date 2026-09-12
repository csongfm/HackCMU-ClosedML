export class AccountConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountConfigurationError';
  }
}

export function assertAccountConfiguration() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new AccountConfigurationError(
      'Add your MongoDB connection string to MONGODB_URI in .env.local, then restart the dev server.',
    );
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new AccountConfigurationError(
      'MONGODB_URI must be a MongoDB connection string starting with mongodb:// or mongodb+srv://.',
    );
  }

  // Atlas assigns real hostnames such as cluster0.example.mongodb.net.
  // Reject explicit template syntax, not words inside valid credentials or hosts.
  if (/<[^>]+>|:\/\/USERNAME:PASSWORD@CLUSTER\.mongodb\.net(?:[/?]|$)/i.test(uri)) {
    throw new AccountConfigurationError(
      'Replace the placeholders in MONGODB_URI in .env.local with your database credentials, and remove the surrounding < > brackets.',
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-with')) {
    throw new AccountConfigurationError(
      'Set AUTH_SECRET in .env.local to a random secret of at least 32 characters, then restart the dev server.',
    );
  }
}

export function accountConfigurationMessage(error: AccountConfigurationError) {
  // Local developers need setup instructions; public clients should not see server details.
  return process.env.NODE_ENV === 'development'
    ? error.message
    : 'Account access is temporarily unavailable. Please try again later.';
}
