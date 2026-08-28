import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

export default function Signup() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-white">MYSTEL</h1>
          <p className="mt-2 text-sm text-slate-400">Client Operations & CRM Platform</p>
        </div>

        <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
              <ShieldAlert className="h-6 w-6 text-amber-400" />
            </div>
            <CardTitle className="text-xl font-bold text-white">Invitation Only</CardTitle>
            <CardDescription className="text-slate-400">
              Account creation is by invitation only. If you are a client, your account will be
              created by the MYSTEL administrator. Please check your email for an invitation link.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Button asChild className="w-full bg-blue-600 hover:bg-blue-500 text-white">
              <Link to="/login">Return to Login</Link>
            </Button>
            <p className="text-xs text-slate-500 text-center">
              If you believe you should have access, please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
