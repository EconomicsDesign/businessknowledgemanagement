// Client-side encryption for sensitive documents
// This ensures documents are encrypted before being sent to any storage

export class DocumentEncryption {
  private static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt document content client-side before upload
   */
  static async encryptDocument(
    content: string, 
    encryptionKey?: string
  ): Promise<{
    encryptedContent: string;
    salt: string;
    iv: string;
    keyId: string;
  }> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    // Generate or derive encryption key
    let key: CryptoKey;
    let salt: Uint8Array;
    let keyId: string;

    if (encryptionKey) {
      // Use provided key with salt
      salt = crypto.getRandomValues(new Uint8Array(16));
      key = await this.deriveKey(encryptionKey, salt);
      keyId = 'user-provided';
    } else {
      // Generate random key (store securely!)
      key = await this.generateKey();
      salt = crypto.getRandomValues(new Uint8Array(16));
      keyId = 'auto-generated';
    }

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the content
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    );

    // Convert to base64 for storage
    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
    const saltBase64 = btoa(String.fromCharCode(...salt));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    return {
      encryptedContent: encryptedBase64,
      salt: saltBase64,
      iv: ivBase64,
      keyId: keyId
    };
  }

  /**
   * Decrypt document content client-side after retrieval
   */
  static async decryptDocument(
    encryptedContent: string,
    salt: string,
    iv: string,
    encryptionKey: string
  ): Promise<string> {
    // Convert from base64
    const encryptedData = new Uint8Array(
      atob(encryptedContent).split('').map(c => c.charCodeAt(0))
    );
    const saltArray = new Uint8Array(
      atob(salt).split('').map(c => c.charCodeAt(0))
    );
    const ivArray = new Uint8Array(
      atob(iv).split('').map(c => c.charCodeAt(0))
    );

    // Derive the key
    const key = await this.deriveKey(encryptionKey, saltArray);

    // Decrypt the content
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivArray,
      },
      key,
      encryptedData
    );

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  }
}

// Storage location configuration
export interface StorageConfig {
  type: 'cloudflare-d1' | 'aws-s3' | 'google-cloud' | 'azure-blob' | 'private-server';
  encrypted: boolean;
  location: string;
  compliance: string[]; // GDPR, HIPAA, SOC2, etc.
}

export const STORAGE_CONFIGURATIONS: Record<string, StorageConfig> = {
  'cloudflare-d1-encrypted': {
    type: 'cloudflare-d1',
    encrypted: true,
    location: 'Cloudflare Global Network (Your Account)',
    compliance: ['GDPR', 'SOC2', 'ISO27001']
  },
  'aws-s3-private': {
    type: 'aws-s3',
    encrypted: true,
    location: 'AWS S3 Private Bucket (Your Account)',
    compliance: ['GDPR', 'HIPAA', 'SOC2', 'ISO27001', 'FedRAMP']
  },
  'private-server': {
    type: 'private-server',
    encrypted: true,
    location: 'Your Private Infrastructure',
    compliance: ['Full Control', 'Custom Compliance']
  }
};