import { secureStorage, config } from '../../../lib';

interface GridResponse {
  success: boolean;
  error?: string;
  message?: string;
  data?: any;
}

interface GridStatusResponse extends GridResponse {
  data?: {
    status: string;
    account?: {
      id: string;
      address: string;
      status: string;
      ready_for_transactions: boolean;
    };
    verification?: {
      required: boolean;
      status: string;
      next_steps: string[];
    };
  };
}

interface GridCreateAccountResponse extends GridResponse {
  data?: {
    account: {
      id: string;
      address: string;
      status: string;
    };
    verification: {
      code: string;
      expires_at: string;
      instructions: string[];
    };
  };
}

interface GridVerifyResponse extends GridResponse {
  data?: {
    account: {
      id: string;
      address: string;
      status: string;
      ready_for_transactions: boolean;
    };
  };
}

interface GridTransactionResponse extends GridResponse {
  data?: {
    transaction_id: string;
    signature: string;
    status: string;
  };
}

class GridService {
  private baseUrl: string;

  constructor() {
    const baseApiUrl = config.backendApiUrl || 'http://localhost:3001';
    this.baseUrl = `${baseApiUrl}/api/grid`;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const token = await secureStorage.getItem('scout_auth_token');
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  async getStatus(): Promise<GridStatusResponse> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'No auth token available'
        };
      }

      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP error! status: ${response.status}`,
          message: data.message
        };
      }

      return data;
    } catch (error) {
      console.error('Grid status error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async createAccount(): Promise<GridCreateAccountResponse> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'No auth token available'
        };
      }

      console.log('🔗 Creating Grid account...');

      const response = await fetch(`${this.baseUrl}/create-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP error! status: ${response.status}`,
          message: data.message
        };
      }

      console.log('🔗 Grid account creation response:', data);
      return data;

    } catch (error) {
      console.error('Grid create account error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async verifyAccount(code: string): Promise<GridVerifyResponse> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'No auth token available'
        };
      }

      console.log('✅ Verifying Grid account...');

      const response = await fetch(`${this.baseUrl}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP error! status: ${response.status}`,
          message: data.message
        };
      }

      console.log('✅ Grid account verification response:', data);
      return data;

    } catch (error) {
      console.error('Grid verify account error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Note: Transaction sending is handled via /api/wallet/send
  // See app/mobile/features/wallet/services/solana.ts sendToken() function
}

export const gridService = new GridService();
