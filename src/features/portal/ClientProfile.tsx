import { useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Lock, CheckCircle } from 'lucide-react';

export default function ClientProfile() {
  const { profile, user, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Password change
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({ first_name: firstName, last_name: lastName })
        .eq('id', user!.id);
      setSuccess(true);
      setEditing(false);
      await refreshProfile();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    setPasswordError('');
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              Profile updated successfully.
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Email:</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={firstName} onChange={(e: any) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={lastName} onChange={(e: any) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">First Name</p>
                <p className="font-medium">{profile?.first_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Name</p>
                <p className="font-medium">{profile?.last_name || '-'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              Password changed successfully.
            </div>
          )}
          {passwordError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{passwordError}</div>
          )}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e: any) => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e: any) => setConfirmPassword(e.target.value)} />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword}>
              {changingPassword ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
