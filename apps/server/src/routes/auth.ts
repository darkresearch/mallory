/**
 * Auth Helper Endpoints
 * Server-side auth operations using service role
 */

import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '../middleware/auth';

const router: Router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * POST /api/auth/set-email
 * 
 * Set email for Web3 authenticated users (bypasses confirmation)
 * Uses service role to directly update auth.users
 * 
 * Body: { email: string }
 * Returns: { success: boolean, email?: string }
 */
router.post('/set-email', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }
    
    console.log('📧 [Set Email] Setting email for user:', req.user!.id);
    
    // Use service role to update auth.users directly (no confirmation needed)
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      req.user!.id,
      {
        email: email,
        email_confirm: true  // Skip email confirmation
      }
    );
    
    if (error) {
      console.error('❌ [Set Email] Failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    console.log('✅ [Set Email] Email set successfully:', {
      userId: req.user!.id,
      email: data.user.email,
    });
    
    res.json({
      success: true,
      email: data.user.email
    });
    
  } catch (error) {
    console.error('❌ [Set Email] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

export default router;

