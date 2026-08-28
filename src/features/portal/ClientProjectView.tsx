import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Calendar, FileText, CheckSquare, Clock, Video, 
  AlertCircle, Download
} from 'lucide-react';
import JitsiMeetingWrapper from '@/components/JitsiMeetingWrapper';

export default function ClientProjectView() {
  const { id } = useParams<{ id: string }>();
  const { clientId } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'documents' | 'meetings'>('overview');
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['portal_project', id, clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          tasks(*),
          documents(*),
          meetings(*)
        `)
        .eq('id', id)
        .eq('client_id', clientId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!clientId,
  });

  if (isLoading) return <div className="p-10 text-muted-foreground text-center">Loading project details...</div>;
  if (error || !project) return <div className="p-10 text-destructive text-center flex flex-col items-center gap-2"><AlertCircle /> Project not found or access denied.</div>;

  const statusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-700';
      case 'Planning': return 'bg-blue-100 text-blue-700';
      case 'Completed': return 'bg-slate-100 text-slate-700';
      case 'On Hold': return 'bg-amber-100 text-amber-700';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const taskStatusColor = (status: string) => {
    switch (status) {
      case 'Done':
      case 'Completed': return 'bg-green-100 text-green-700';
      case 'In Progress': return 'bg-blue-100 text-blue-700';
      case 'Review': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="icon" asChild>
          <Link to="/portal/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(project.status)}`}>
              {project.status}
            </span>
            {project.start_date && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Started: {new Date(project.start_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex space-x-2 border-b pb-2 overflow-x-auto hide-scrollbar">
        <Button variant={activeTab === 'overview' ? 'default' : 'ghost'} onClick={() => setActiveTab('overview')}>Overview</Button>
        <Button variant={activeTab === 'tasks' ? 'default' : 'ghost'} onClick={() => setActiveTab('tasks')}>Tasks ({project.tasks?.length || 0})</Button>
        <Button variant={activeTab === 'documents' ? 'default' : 'ghost'} onClick={() => setActiveTab('documents')}>Documents ({project.documents?.length || 0})</Button>
        <Button variant={activeTab === 'meetings' ? 'default' : 'ghost'} onClick={() => setActiveTab('meetings')}>Meetings ({project.meetings?.length || 0})</Button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.description ? (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</div>
              ) : (
                <div className="text-sm text-muted-foreground italic">No description provided.</div>
              )}
              
              <div className="pt-4 border-t space-y-3">
                {project.target_date && (
                  <div className="flex items-center text-sm">
                    <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="font-medium mr-2">Target Date:</span> 
                    {new Date(project.target_date).toLocaleDateString()}
                  </div>
                )}
                {project.budget && (
                  <div className="flex items-center text-sm">
                    <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="font-medium mr-2">Budget:</span> 
                    {project.currency || 'USD'} {project.budget.toLocaleString()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm text-muted-foreground">Total Tasks</span>
                  <span className="font-bold">{project.tasks?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm text-muted-foreground">Completed Tasks</span>
                  <span className="font-bold text-green-600">
                    {project.tasks?.filter((t: any) => t.status === 'Done' || t.status === 'Completed').length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2">
                  <span className="text-sm text-muted-foreground">Upcoming Meetings</span>
                  <span className="font-bold text-indigo-600">
                    {project.meetings?.filter((m: any) => new Date(m.start_time) > new Date()).length || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'tasks' && (
        <Card>
          <CardHeader>
            <CardTitle>Project Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {!project.tasks || project.tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                <CheckSquare className="h-8 w-8 mb-2 opacity-20" />
                No tasks assigned to this project yet.
              </div>
            ) : (
              <div className="space-y-3">
                {project.tasks.map((task: any) => (
                  <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors gap-4">
                    <div>
                      <div className="font-medium">{task.title}</div>
                      {task.description && (
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-1">{task.description}</div>
                      )}
                      {task.due_date && (
                        <div className="flex items-center text-xs text-muted-foreground mt-2">
                          <Calendar className="h-3 w-3 mr-1" />
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${taskStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                      <span className="text-xs border px-2 py-1 rounded bg-background text-muted-foreground">
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle>Project Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {!project.documents || project.documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                <FileText className="h-8 w-8 mb-2 opacity-20" />
                No documents uploaded for this project.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {project.documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 bg-primary/10 text-primary rounded">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-medium text-sm truncate">{doc.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {doc.file_type || 'Unknown type'} • {doc.file_size ? Math.round(doc.file_size / 1024) + ' KB' : '--'}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" title="Download feature not implemented in preview">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'meetings' && (
        <div className="space-y-4">
          {!project.meetings || project.meetings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Video className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No meetings scheduled for this project.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {project.meetings.map((meeting: any) => (
                <Card key={meeting.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{meeting.title}</CardTitle>
                    <div className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1 rounded bg-muted px-2 py-1 w-fit mt-2">
                      {meeting.status}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {new Date(meeting.start_time).toLocaleString()}
                      </div>
                      {meeting.description && (
                        <div className="text-muted-foreground">
                          {meeting.description}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 pt-2">
                      <Button variant="default" className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => setActiveRoom(meeting.id)}>
                        <Video className="mr-2 h-4 w-4" /> Join Meeting
                      </Button>
                      {meeting.meeting_url && (
                        <Button variant="secondary" className="w-full" asChild>
                          <a href={meeting.meeting_url} target="_blank" rel="noopener noreferrer">
                            <Video className="mr-2 h-4 w-4" /> External Link
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeRoom && (
        <JitsiMeetingWrapper 
          roomName={activeRoom} 
          onClose={() => setActiveRoom(null)} 
        />
      )}
    </div>
  );
}
