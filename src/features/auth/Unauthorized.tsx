import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldX, ArrowLeft, LogIn } from 'lucide-react';

export default function Unauthorized() {
  const { session, isAdmin, isClient, signOut } = useAuth();

  const getRedirectPath = () => {
    if (isAdmin) return '/app/dashboard';
    if (isClient) return '/portal';
    return '/login';
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-white">MYSTEL</h1>
        </div>

        <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <ShieldX className="h-6 w-6 text-red-400" />
            </div>
            <CardTitle className="text-xl font-bold text-white">Access Denied</CardTitle>
            <CardDescription className="text-slate-400">
              {session
                ? "You don't have permission to access this page. You may have been redirected because your account role doesn't include access to this area."
                : "You need to sign in to access this page."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {session ? (
              <>
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                  <Link to={getRedirectPath()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go to My Dashboard
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-white"
                  onClick={signOut}
                >
                  Sign out and use a different account
                </Button>
              </>
            ) : (
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                <Link to="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
