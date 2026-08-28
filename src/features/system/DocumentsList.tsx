import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { File, FileText, Image, Upload, Download, Trash2, Plus, Folder } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const FILE_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileText,
  xlsx: FileText,
  png: Image,
  jpg: Image,
  jpeg: Image,
  gif: Image,
  svg: Image,
};

function getFileIcon(fileName: string): React.ElementType {
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || File;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsComponent() {
  const { organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docName, setDocName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['admin_documents', organizationId, filterClient],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase
        .from('documents')
        .select('*, client:clients(name), project:projects(name), uploader:profiles(first_name, last_name)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (filterClient) query = query.eq('client_id', filterClient);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients_for_docs', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase.from('clients').select('id, name').eq('organization_id', organizationId);
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: projects } = useQuery({
    queryKey: ['projects_for_docs', organizationId, selectedClientId],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase.from('projects').select('id, name').eq('organization_id', organizationId);
      if (selectedClientId) query = query.eq('client_id', selectedClientId);
      const { data } = await query;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const handleUpload = async () => {
    if (!selectedFile || !organizationId || !user) return;
    setUploading(true);
    try {
      const ext = selectedFile.name.split('.').pop();
      const timestamp = Date.now();
      const filePath = `${organizationId}/${selectedClientId || 'org'}/${timestamp}_${selectedFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, selectedFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documents').insert([{
        organization_id: organizationId,
        client_id: selectedClientId || null,
        project_id: selectedProjectId || null,
        name: docName || selectedFile.name,
        file_path: filePath,
        file_type: selectedFile.type || ext || 'unknown',
        file_size: selectedFile.size,
        bucket_name: 'client-documents',
        uploaded_by: user.id,
      }]);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ['admin_documents'] });
      toast({ title: 'Document uploaded successfully.' });
      setOpen(false);
      setSelectedFile(null);
      setDocName('');
      setSelectedClientId('');
      setSelectedProjectId('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = useMutation({
    mutationFn: async (doc: any) => {
      // Delete from storage
      await supabase.storage.from(doc.bucket_name).remove([doc.file_path]);
      // Delete from DB
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_documents'] });
      toast({ title: 'Document deleted.' });
    },
    onError: (err: any) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const downloadDocument = async (doc: any) => {
    try {
      const { data } = await supabase.storage.from(doc.bucket_name).createSignedUrl(doc.file_path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Folder className="h-7 w-7 text-blue-500" /> Documents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and share documents with clients</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Upload Document</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Document Name (optional)</Label>
                <Input value={docName} onChange={e => setDocName(e.target.value)} placeholder="Leave blank to use filename" />
              </div>
              <div className="space-y-2">
                <Label>Client (optional)</Label>
                <select
                  className="w-full rounded-md border p-2 bg-background text-sm"
                  value={selectedClientId}
                  onChange={e => { setSelectedClientId(e.target.value); setSelectedProjectId(''); }}
                >
                  <option value="">No specific client (organization)</option>
                  {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {selectedClientId && (
                <div className="space-y-2">
                  <Label>Project (optional)</Label>
                  <select
                    className="w-full rounded-md border p-2 bg-background text-sm"
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">No specific project</option>
                    {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label>File *</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  {selectedFile ? (
                    <div>
                      <p className="font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">Click to select a file</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">PDF, Word, Excel, Images, etc.</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Label className="shrink-0 text-sm">Filter by client:</Label>
        <select
          className="rounded-md border p-2 bg-background text-sm max-w-[200px]"
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
        >
          <option value="">All clients</option>
          {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground">Loading documents...</div>
      ) : !documents || documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Folder className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground">No documents yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Upload documents to share with clients.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {documents.map((doc: any) => {
                const FileIcon = getFileIcon(doc.name);
                return (
                  <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{doc.file_type}</span>
                        <span>·</span>
                        <span>{formatSize(doc.file_size)}</span>
                        <span>·</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        {doc.client?.name && (
                          <>
                            <span>·</span>
                            <span className="bg-muted px-1.5 py-0.5 rounded">{doc.client.name}</span>
                          </>
                        )}
                        {doc.project?.name && (
                          <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{doc.project.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => downloadDocument(doc)} title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete "${doc.name}"? This cannot be undone.`)) {
                            deleteDocument.mutate(doc);
                          }
                        }}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
