import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Unauthorized() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center space-y-4">
      <h1 className="text-4xl font-bold">Unauthorized</h1>
      <p className="text-muted-foreground">You don't have permission to access this page.</p>
      <Button asChild>
        <Link to="/">Go Back</Link>
      </Button>
    </div>
  );
}
