import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

/**
 * Authentication middleware
 * Validates Supabase JWT token from Authorization header
 */
export async function authenticateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'No authorization token provided',
        message: 'Please provide a valid Bearer token'
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    // Validate token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('🔒 Auth error:', error?.message);
      res.status(401).json({ 
        error: 'Invalid or expired token',
        message: 'Please sign in again'
      });
      return;
    }

    // Attach user to request
    req.user = user;
    
    console.log('✅ User authenticated:', user.id);
    next();
  } catch (error) {
    console.error('🔒 Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      message: 'Failed to validate authentication token'
    });
  }
}

