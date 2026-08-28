


interface JitsiMeetingWrapperProps {
  roomName: string;
  onClose: () => void;
}

export default function JitsiMeetingWrapper({ roomName, onClose }: JitsiMeetingWrapperProps) {

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-6xl h-[85vh] bg-background rounded-lg overflow-hidden shadow-2xl flex flex-col">
        <div className="flex justify-between items-center px-4 py-3 bg-card border-b">
          <h2 className="text-lg font-semibold tracking-tight">Meeting Room: {roomName}</h2>
          <button 
            onClick={onClose}
            className="px-3 py-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-md text-sm font-medium transition-colors"
          >
            Leave Meeting
          </button>
        </div>
        <div className="flex-1 w-full flex flex-col items-center justify-center p-8 bg-muted/30">
          <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          </div>
          <h3 className="text-2xl font-bold mb-2">Ready to join?</h3>
          <p className="text-muted-foreground text-center max-w-md mb-8">
            To ensure the best experience and avoid login requirements, your secure meeting will open in a new secure window.
          </p>
          
          <button 
            onClick={() => {
              const url = `https://meet.ffmuc.net/mystel_${roomName.replace(/[^a-zA-Z0-9]/g, '_')}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="px-8 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            Join Meeting Now
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
