import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login', AuthController.login);
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  AuthController.googleCallback
);
router.get('/me', authenticate, AuthController.me);
router.post('/logout', authenticate, AuthController.logout);

export default router;
