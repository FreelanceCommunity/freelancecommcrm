import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export default function ClientMessages() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">Messaging coming soon</p>
          <p className="text-xs text-muted-foreground mt-1">
            For now, please use support tickets to communicate with our team.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
