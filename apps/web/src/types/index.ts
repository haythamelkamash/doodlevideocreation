// ─── Core Domain Types ────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'admin' | 'editor' | 'viewer' | 'guest';
export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type ExportFormat = 'mp4' | 'mov' | 'webm' | 'gif';
export type ExportQuality = '720p' | '1080p' | '4k';
export type ExportStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
export type AnimationType = 'draw' | 'fade' | 'slide' | 'zoom' | 'morph' | 'rotate';
export type HandType = 'left' | 'right';
export type DrawEffect = 'pencil' | 'marker' | 'brush';
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
export type AssetCategory = 'image' | 'icon' | 'character' | 'background' | 'prop';
export type Industry = 'business' | 'education' | 'healthcare' | 'oil-gas' | 'engineering' | 'marketing';

// ─── User & Auth ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  plan: PlanTier;
  teamId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  expiresAt: number;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  duration: number; // seconds
  ownerId: string;
  teamId?: string;
  scenes: Scene[];
  settings: ProjectSettings;
  exportStatus: ExportStatus;
  lastExportedAt?: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  backgroundColor: string;
  backgroundType: 'whiteboard' | 'blackboard' | 'glassboard' | 'custom';
  backgroundImageUrl?: string;
  defaultHandType: HandType;
  defaultDrawEffect: DrawEffect;
  defaultAnimationSpeed: number;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export interface Scene {
  id: string;
  projectId: string;
  order: number;
  title: string;
  duration: number;
  transitionType: 'none' | 'fade' | 'slide' | 'zoom';
  transitionDuration: number;
  elements: SceneElement[];
  audioTracks: AudioTrack[];
  thumbnail?: string;
}

export interface SceneElement {
  id: string;
  type: 'image' | 'text' | 'shape' | 'character' | 'icon' | 'drawing';
  assetId?: string;
  src?: string;
  content?: string; // for text elements
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  animation: ElementAnimation;
  fabricObjectJson?: string; // serialized Fabric.js object
}

export interface ElementAnimation {
  type: AnimationType;
  drawEffect?: DrawEffect;
  handType?: HandType;
  startTime: number;  // seconds from scene start
  duration: number;
  delay: number;
  speed: number;
  easing: EasingType;
  pathData?: string; // SVG path for draw animation tracing
}

// ─── Audio ────────────────────────────────────────────────────────────────────

export interface AudioTrack {
  id: string;
  type: 'voiceover' | 'music' | 'sfx';
  src: string;
  startTime: number;
  duration: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  label?: string;
}

export interface TTSRequest {
  text: string;
  provider: 'openai' | 'elevenlabs' | 'azure';
  voice: string;
  speed: number;
  pitch?: number;
}

// ─── Asset ────────────────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  industry?: Industry;
  tags: string[];
  url: string;
  thumbnailUrl: string;
  mimeType: string;
  width?: number;
  height?: number;
  svgPaths?: SVGPathData[]; // for draw animation
  isPremium: boolean;
  createdAt: string;
}

export interface SVGPathData {
  d: string;
  drawOrder: number;
  estimatedDuration: number;
}

// ─── Template ─────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  previewVideoUrl?: string;
  industry: Industry;
  category: string;
  tags: string[];
  sceneCount: number;
  duration: number;
  isPremium: boolean;
  projectSnapshot: Partial<Project>;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportJob {
  id: string;
  projectId: string;
  format: ExportFormat;
  quality: ExportQuality;
  status: ExportStatus;
  progress: number;
  outputUrl?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export interface ScriptGenerationRequest {
  topic: string;
  industry: Industry;
  audience: string;
  durationSeconds: number;
  tone: 'professional' | 'casual' | 'educational' | 'persuasive';
  language: string;
}

export interface GeneratedScript {
  title: string;
  script: string;
  scenes: GeneratedScene[];
  totalDuration: number;
  voiceoverText: string;
}

export interface GeneratedScene {
  order: number;
  title: string;
  description: string;
  duration: number;
  suggestedCharacters: string[];
  suggestedAssets: string[];
  animationSuggestions: string[];
  voiceoverSegment: string;
}

// ─── Team / Collaboration ─────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  plan: PlanTier;
  ownerId: string;
  members: TeamMember[];
  createdAt: string;
}

export interface TeamMember {
  userId: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
  role: UserRole;
  joinedAt: string;
}

export interface Comment {
  id: string;
  projectId: string;
  sceneId?: string;
  elementId?: string;
  authorId: string;
  author: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  content: string;
  resolved: boolean;
  timestamp: number; // video timecode
  replies: Comment[];
  createdAt: string;
}

// ─── Timeline / Editor State ──────────────────────────────────────────────────

export interface TimelineTrack {
  id: string;
  type: 'element' | 'audio' | 'transition';
  label: string;
  items: TimelineItem[];
  isLocked: boolean;
  isVisible: boolean;
  isMuted?: boolean;
}

export interface TimelineItem {
  id: string;
  trackId: string;
  elementId?: string;
  audioTrackId?: string;
  startTime: number;
  duration: number;
  label: string;
  color: string;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  price: { monthly: number; annual: number };
  features: string[];
  limits: {
    projects: number;
    exports: number;
    storageGb: number;
    aiCredits: number;
    teamMembers: number;
    maxVideoDurationMinutes: number;
    exportFormats: ExportFormat[];
    maxExportQuality: ExportQuality;
  };
}

// ─── Oil & Gas Module ─────────────────────────────────────────────────────────

export type OilGasScenarioType =
  | 'well-control'
  | 'blowout-prevention'
  | 'managed-pressure-drilling'
  | 'drilling-operations'
  | 'equipment-illustration'
  | 'process-flow'
  | 'safety-emergency-response'
  | 'kick-detection'
  | 'well-completion';

export interface OilGasTrainingModule {
  id: string;
  title: string;
  scenarioType: OilGasScenarioType;
  description: string;
  learningObjectives: string[];
  assets: Asset[];
  templates: Template[];
  certificationLevel?: 'awareness' | 'operator' | 'supervisor' | 'engineer';
  regulatoryReferences: string[];
}
