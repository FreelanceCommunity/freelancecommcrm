import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientProfile() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <div className="text-sm text-muted-foreground mt-1">{user?.email}</div>
          </div>
          <div>
            <label className="text-sm font-medium">Status</label>
            <div className="text-sm text-muted-foreground mt-1">Active Client</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
