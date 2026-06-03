import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import loginBg from '@/assets/login-bg.jpg';
import { Building2 } from 'lucide-react';

const Login = () => {
  const { user, loading, signIn, signUp, roles } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-foreground border-t-transparent" />
      </div>
    );
  }

  if (user) {
    const dest = roles.includes('admin')
      ? '/admin'
      : roles.includes('procurement_officer') && !roles.some(r => r !== 'procurement_officer')
        ? '/suppliers'
        : '/projects';
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) throw error;
        toast.success('Account created! Check your email to verify.');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success('Welcome back!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <img
        src={loginBg}
        alt="Construction site background"
        className="absolute inset-0 h-full w-full object-cover"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/70 to-primary/40" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="rounded-xl bg-card/95 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-foreground">Rocdwels Nigeria Ltd</h1>
              <p className="text-sm text-muted-foreground">Construction ERP System</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@rocdwels.ng"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary hover:underline"
              >
                {isSignUp ? 'Already have an account?' : 'Create account'}
              </button>
              <a href="#" className="text-muted-foreground hover:text-primary">
                Manage password
              </a>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base h-11"
            >
              {isSubmitting ? 'Please wait...' : isSignUp ? 'SIGN UP' : 'LOG IN'}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default Login;
