
import { JitsiMeeting } from '@jitsi/react-sdk';
import { useAuth } from '@/features/auth/AuthContext';

interface JitsiMeetingWrapperProps {
  roomName: string;
  onClose: () => void;
}

export default function JitsiMeetingWrapper({ roomName, onClose }: JitsiMeetingWrapperProps) {
  const { user } = useAuth();
  
  const displayName = user?.user_metadata?.first_name 
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
    : user?.email || 'Guest';

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
        <div className="flex-1 w-full bg-black">
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={`mystel_${roomName.replace(/[^a-zA-Z0-9]/g, '_')}`}
            configOverwrite={{
              startWithAudioMuted: false,
              disableModeratorIndicator: true,
              startScreenSharing: false,
              enableEmailInStats: false,
              prejoinPageEnabled: false,
              requireDisplayName: false,
              localRecording: {
                enabled: true,
                format: 'ogg'
              },
              toolbarButtons: [
                'camera', 'chat', 'closedcaptions', 'desktop', 'download', 'embedmeeting',
                'etherpad', 'feedback', 'filmstrip', 'fullscreen', 'hangup', 'help',
                'highlight', 'invite', 'linktosalesforce', 'livestreaming', 'localrecording',
                'microphone', 'mute-everyone', 'mute-video-everyone', 'participants-pane',
                'profile', 'raisehand', 'recording', 'security', 'select-background',
                'settings', 'shareaudio', 'sharedvideo', 'shortcuts', 'stats', 'tileview',
                'toggle-camera', 'videoquality', 'whiteboard'
              ]
            }}
            interfaceConfigOverwrite={{
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
              SHOW_JITSI_WATERMARK: false
            }}
            userInfo={{
              displayName: displayName,
              email: user?.email || ''
            }}
            onApiReady={(externalApi) => {
              externalApi.addListener('videoConferenceLeft', () => {
                onClose();
              });
            }}
            getIFrameRef={(iframeRef) => {
              iframeRef.style.height = '100%';
              iframeRef.style.width = '100%';
            }}
          />
        </div>
      </div>
    </div>
  );
}
