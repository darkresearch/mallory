export interface ChatInputProps {
  onSend?: (message: string) => void;
  onVoiceStart?: () => void;
  onVoiceEnd?: (audioBlob: Blob) => void;
  onAttachmentPress?: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLines?: number;
}

export interface ChatInputState {
  text: string;
  isRecording: boolean;
  isSending: boolean;
  height: number;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio';
  url: string;
  name?: string;
  size?: number;
}
