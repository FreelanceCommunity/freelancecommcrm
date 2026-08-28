import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { File, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ClientDocuments() {
  const { clientId } = useAuth();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['portal_documents', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage
      .from(doc.bucket_name)
      .createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading documents...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Documents</h1>

      {!documents || documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <File className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No documents available.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {documents.map((doc: any) => (
                <div key={doc.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <File className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_type || 'File'} • {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''} • {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
