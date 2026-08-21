export type APIKey = {
  id: string;
  userId: string;
  service: 'alpaca' | 'ibkr' | 'yahoo' | 'openai' | 'custom';
  name: string;
  encryptedKey: string;
  encryptedSecret?: string | undefined;
  createdAt: string;
  lastUsed?: string | undefined;
  isActive: boolean;
};

export type APIKeyCreate = {
  service: APIKey['service'];
  name: string;
  apiKey: string;
  apiSecret?: string;
};

// Simple encryption (replace with proper encryption in production)
class EncryptionService {
  private encryptionKey = 'default_encryption_key_replace_in_production';

  encrypt(text: string): string {
    // Simple XOR encryption - replace with AES in production
    const key = this.encryptionKey;
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
  }

  decrypt(encrypted: string): string {
    try {
      const text = atob(encrypted);
      const key = this.encryptionKey;
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch {
      return '';
    }
  }

  generateSecureKey(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

class APIKeyManager {
  private keys: Map<string, APIKey> = new Map();
  private encryption = new EncryptionService();

  async createKey(userId: string, data: APIKeyCreate): Promise<APIKey> {
    const id = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const apiKey: APIKey = {
      id,
      userId,
      service: data.service,
      name: data.name,
      encryptedKey: this.encryption.encrypt(data.apiKey),
      encryptedSecret: data.apiSecret ? this.encryption.encrypt(data.apiSecret) : undefined,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    this.keys.set(id, apiKey);
    return apiKey;
  }

  async getKey(keyId: string): Promise<APIKey | null> {
    return this.keys.get(keyId) || null;
  }

  async getDecryptedKey(keyId: string): Promise<{ apiKey: string; apiSecret?: string } | null> {
    const key = this.keys.get(keyId);
    if (!key || !key.isActive) {
      return null;
    }

    const result: { apiKey: string; apiSecret?: string } = {
      apiKey: this.encryption.decrypt(key.encryptedKey),
    };
    
    if (key.encryptedSecret) {
      result.apiSecret = this.encryption.decrypt(key.encryptedSecret);
    }
    
    return result;
  }

  async getKeysByUser(userId: string): Promise<APIKey[]> {
    return Array.from(this.keys.values()).filter(k => k.userId === userId);
  }

  async getKeysByService(userId: string, service: APIKey['service']): Promise<APIKey[]> {
    return Array.from(this.keys.values())
      .filter(k => k.userId === userId && k.service === service);
  }

  async updateKey(keyId: string, updates: Partial<Omit<APIKey, 'id' | 'userId' | 'createdAt'>> & { apiKey?: string; apiSecret?: string }): Promise<APIKey | null> {
    const key = this.keys.get(keyId);
    if (!key) {
      return null;
    }

    const updatedKey: APIKey = {
      ...key,
      ...updates,
      encryptedKey: updates.apiKey ? this.encryption.encrypt(updates.apiKey) : key.encryptedKey,
      encryptedSecret: updates.apiSecret ? this.encryption.encrypt(updates.apiSecret) : key.encryptedSecret,
    };

    this.keys.set(keyId, updatedKey);
    return updatedKey;
  }

  async deleteKey(keyId: string): Promise<boolean> {
    return this.keys.delete(keyId);
  }

  async deactivateKey(keyId: string): Promise<APIKey | null> {
    const key = this.keys.get(keyId);
    if (!key) {
      return null;
    }

    key.isActive = false;
    this.keys.set(keyId, key);
    return key;
  }

  async markAsUsed(keyId: string): Promise<APIKey | null> {
    const key = this.keys.get(keyId);
    if (!key) {
      return null;
    }

    key.lastUsed = new Date().toISOString();
    this.keys.set(keyId, key);
    return key;
  }

  validateKeyFormat(service: APIKey['service'], apiKey: string): boolean {
    switch (service) {
      case 'alpaca':
        return /^[A-Z0-9]{16,20}$/.test(apiKey);
      case 'ibkr':
        return /^[a-z0-9]{8,12}$/.test(apiKey);
      case 'yahoo':
        return apiKey.length > 10;
      case 'openai':
        return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey);
      default:
        return apiKey.length > 5;
    }
  }
}

// Singleton instance
const apiKeyManager = new APIKeyManager();

export const securityAPI = {
  async createKey(userId: string, data: APIKeyCreate): Promise<APIKey> {
    if (!apiKeyManager.validateKeyFormat(data.service, data.apiKey)) {
      throw new Error(`Invalid API key format for ${data.service}`);
    }
    return apiKeyManager.createKey(userId, data);
  },

  async getKey(keyId: string): Promise<APIKey | null> {
    return apiKeyManager.getKey(keyId);
  },

  async getDecryptedKey(keyId: string): Promise<{ apiKey: string; apiSecret?: string } | null> {
    return apiKeyManager.getDecryptedKey(keyId);
  },

  async getKeysByUser(userId: string): Promise<APIKey[]> {
    return apiKeyManager.getKeysByUser(userId);
  },

  async getKeysByService(userId: string, service: APIKey['service']): Promise<APIKey[]> {
    return apiKeyManager.getKeysByService(userId, service);
  },

  async updateKey(keyId: string, updates: Partial<Omit<APIKey, 'id' | 'userId' | 'createdAt'>>): Promise<APIKey | null> {
    return apiKeyManager.updateKey(keyId, updates);
  },

  async deleteKey(keyId: string): Promise<boolean> {
    return apiKeyManager.deleteKey(keyId);
  },

  async deactivateKey(keyId: string): Promise<APIKey | null> {
    return apiKeyManager.deactivateKey(keyId);
  },

  async markAsUsed(keyId: string): Promise<APIKey | null> {
    return apiKeyManager.markAsUsed(keyId);
  },
};

// Environment variable management
export function getEnvVar(name: string, defaultValue?: string): string {
  if (typeof window !== 'undefined') {
    // Client-side - should never expose sensitive keys
    throw new Error('Cannot access sensitive environment variables on client side');
  }
  return process.env[name] || defaultValue || '';
}

export function setEnvVar(name: string, value: string): void {
  if (typeof window !== 'undefined') {
    // Store in localStorage for development only
    localStorage.setItem(`env_${name}`, value);
  } else {
    process.env[name] = value;
  }
}

// Data encryption utilities
export function encryptData(data: any): string {
  const encryption = new EncryptionService();
  return encryption.encrypt(JSON.stringify(data));
}

export function decryptData(encrypted: string): any {
  try {
    const encryption = new EncryptionService();
    return JSON.parse(encryption.decrypt(encrypted));
  } catch {
    return null;
  }
}

// Secure storage for client-side
export function secureSetItem(key: string, value: string): void {
  const encryption = new EncryptionService();
  localStorage.setItem(key, encryption.encrypt(value));
}

export function secureGetItem(key: string): string | null {
  try {
    const encryption = new EncryptionService();
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;
    return encryption.decrypt(encrypted);
  } catch {
    return null;
  }
}

export function secureRemoveItem(key: string): void {
  localStorage.removeItem(key);
}
