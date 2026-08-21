export type User = {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  lastLogin: string;
  preferences: UserPreferences;
};

export type UserPreferences = {
  theme: 'light' | 'dark' | 'system';
  defaultMarket: 'india' | 'us' | 'global';
  notifications: boolean;
  emailAlerts: boolean;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
};

export type AuthSession = {
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterData = {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
};

export type AuthResult = {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
};

// Simple in-memory database (replace with real database in production)
class InMemoryDatabase {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, AuthSession> = new Map();
  private passwordHashes: Map<string, string> = new Map();

  async hashPassword(password: string): Promise<string> {
    // Simple hash - replace with bcrypt in production
    return btoa(password + '_salt_secret');
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const hashed = await this.hashPassword(password);
    return hashed === hash;
  }

  async register(data: RegisterData): Promise<AuthResult> {
    // Validation
    if (data.password !== data.confirmPassword) {
      return { success: false, error: 'Passwords do not match' };
    }

    if (data.password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    if (this.passwordHashes.has(data.email)) {
      return { success: false, error: 'Email already registered' };
    }

    // Create user
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: data.email,
      username: data.username,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      preferences: {
        theme: 'system',
        defaultMarket: 'us',
        notifications: true,
        emailAlerts: false,
        riskTolerance: 'moderate',
      },
    };

    const passwordHash = await this.hashPassword(data.password);

    this.users.set(user.id, user);
    this.passwordHashes.set(data.email, passwordHash);

    // Create session
    const session = await this.createSession(user.id);
    if (!session) {
      return { success: false, error: 'Failed to create session' };
    }

    return {
      success: true,
      user,
      token: session.token,
    };
  }

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const passwordHash = this.passwordHashes.get(credentials.email);
    if (!passwordHash) {
      return { success: false, error: 'Invalid email or password' };
    }

    const isValid = await this.verifyPassword(credentials.password, passwordHash);
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Find user by email
    let user: User | undefined;
    for (const u of this.users.values()) {
      if (u.email === credentials.email) {
        user = u;
        break;
      }
    }

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Update last login
    user.lastLogin = new Date().toISOString();
    this.users.set(user.id, user);

    // Create session
    const session = await this.createSession(user.id);
    if (!session) {
      return { success: false, error: 'Failed to create session' };
    }

    return {
      success: true,
      user,
      token: session.token,
    };
  }

  async createSession(userId: string): Promise<AuthSession | null> {
    const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 32)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const session: AuthSession = {
      userId,
      token,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(token, session);
    return session;
  }

  async validateSession(token: string): Promise<User | null> {
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }

    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      return null;
    }

    return this.users.get(session.userId) || null;
  }

  async logout(token: string): Promise<boolean> {
    return this.sessions.delete(token);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const updatedUser = { ...user, ...updates };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const updatedUser = {
      ...user,
      preferences: { ...user.preferences, ...preferences },
    };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  getUserById(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }
}

// Singleton instance
const db = new InMemoryDatabase();

// Auth functions
export const authAPI = {
  async register(data: RegisterData): Promise<AuthResult> {
    return db.register(data);
  },

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    return db.login(credentials);
  },

  async logout(token: string): Promise<boolean> {
    return db.logout(token);
  },

  async validateToken(token: string): Promise<User | null> {
    return db.validateSession(token);
  },

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    return db.updateUser(userId, updates);
  },

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<User | null> {
    return db.updatePreferences(userId, preferences);
  },

  getCurrentUser(): User | null {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    return db.getUserById(token.split('_')[1] || '');
  },
};

// Client-side auth utilities
export function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function removeAuthToken(): void {
  localStorage.removeItem('auth_token');
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export function logout(): void {
  const token = getAuthToken();
  if (token) {
    authAPI.logout(token);
  }
  removeAuthToken();
}
