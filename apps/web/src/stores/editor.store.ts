import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  Project, Scene, SceneElement, ElementAnimation,
  TimelineTrack, TimelineItem, AudioTrack, ExportJob,
} from '@/types';

// ─── History Entry ────────────────────────────────────────────────────────────

interface HistoryEntry {
  scenes: Scene[];
  timestamp: number;
  description: string;
}

// ─── Editor State ─────────────────────────────────────────────────────────────

interface EditorState {
  project: Project | null;
  activeSceneId: string | null;
  selectedElementIds: string[];
  currentTime: number; // seconds
  isPlaying: boolean;
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  timelineTracks: TimelineTrack[];
  history: HistoryEntry[];
  historyIndex: number;
  isSaving: boolean;
  isDirty: boolean;
  activeExportJob: ExportJob | null;
  clipboardElements: SceneElement[];
  panOffset: { x: number; y: number };
}

// ─── Editor Actions ───────────────────────────────────────────────────────────

interface EditorActions {
  // Project
  setProject: (project: Project) => void;
  saveProject: () => Promise<void>;

  // Scene management
  setActiveScene: (sceneId: string) => void;
  addScene: (after?: string) => void;
  deleteScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;

  // Element management
  addElement: (sceneId: string, element: SceneElement) => void;
  updateElement: (sceneId: string, elementId: string, updates: Partial<SceneElement>) => void;
  deleteElements: (sceneId: string, elementIds: string[]) => void;
  selectElements: (elementIds: string[]) => void;
  clearSelection: () => void;
  copyElements: () => void;
  pasteElements: () => void;
  bringForward: (sceneId: string, elementId: string) => void;
  sendBackward: (sceneId: string, elementId: string) => void;

  // Animation
  updateElementAnimation: (sceneId: string, elementId: string, animation: Partial<ElementAnimation>) => void;

  // Audio
  addAudioTrack: (sceneId: string, track: AudioTrack) => void;
  updateAudioTrack: (sceneId: string, trackId: string, updates: Partial<AudioTrack>) => void;
  deleteAudioTrack: (sceneId: string, trackId: string) => void;

  // Playback
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;

  // Canvas view
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setPanOffset: (offset: { x: number; y: number }) => void;

  // Timeline
  rebuildTimeline: () => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: (description: string) => void;

  // Export
  setActiveExportJob: (job: ExportJob | null) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildTimelineTracks(scenes: Scene[]): TimelineTrack[] {
  const tracks: TimelineTrack[] = [];
  let globalTime = 0;

  for (const scene of scenes) {
    for (const el of scene.elements) {
      const anim = el.animation;
      const absoluteStart = globalTime + anim.startTime;
      let track = tracks.find((t) => t.id === `element-${el.id}`);
      if (!track) {
        track = { id: `element-${el.id}`, type: 'element', label: el.type, items: [], isLocked: false, isVisible: true };
        tracks.push(track);
      }
      track.items.push({
        id: `item-${el.id}`,
        trackId: track.id,
        elementId: el.id,
        startTime: absoluteStart,
        duration: anim.duration,
        label: el.type,
        color: '#6366f1',
      });
    }

    for (const audio of scene.audioTracks) {
      let track = tracks.find((t) => t.id === `audio-${audio.id}`);
      if (!track) {
        track = { id: `audio-${audio.id}`, type: 'audio', label: audio.label ?? audio.type, items: [], isLocked: false, isVisible: true, isMuted: false };
        tracks.push(track);
      }
      track.items.push({
        id: `aitem-${audio.id}`,
        trackId: track.id,
        audioTrackId: audio.id,
        startTime: globalTime + audio.startTime,
        duration: audio.duration,
        label: audio.label ?? audio.type,
        color: '#22c55e',
      });
    }

    globalTime += scene.duration + scene.transitionDuration;
  }

  return tracks;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState & EditorActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        project: null,
        activeSceneId: null,
        selectedElementIds: [],
        currentTime: 0,
        isPlaying: false,
        zoom: 1,
        showGrid: false,
        snapToGrid: false,
        gridSize: 20,
        timelineTracks: [],
        history: [],
        historyIndex: -1,
        isSaving: false,
        isDirty: false,
        activeExportJob: null,
        clipboardElements: [],
        panOffset: { x: 0, y: 0 },

        setProject: (project) => set((s) => {
          s.project = project;
          s.activeSceneId = project.scenes[0]?.id ?? null;
          s.timelineTracks = buildTimelineTracks(project.scenes);
          s.history = [];
          s.historyIndex = -1;
          s.isDirty = false;
        }),

        saveProject: async () => {
          const { project } = get();
          if (!project) return;
          set((s) => { s.isSaving = true; });
          try {
            await fetch(`/api/projects/${project.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(project),
            });
            set((s) => { s.isDirty = false; });
          } finally {
            set((s) => { s.isSaving = false; });
          }
        },

        setActiveScene: (sceneId) => set((s) => { s.activeSceneId = sceneId; }),

        addScene: (after) => set((s) => {
          if (!s.project) return;
          const newScene: Scene = {
            id: generateId(),
            projectId: s.project.id,
            order: s.project.scenes.length,
            title: `Scene ${s.project.scenes.length + 1}`,
            duration: 5,
            transitionType: 'fade',
            transitionDuration: 0.5,
            elements: [],
            audioTracks: [],
          };
          if (after) {
            const idx = s.project.scenes.findIndex((sc) => sc.id === after);
            s.project.scenes.splice(idx + 1, 0, newScene);
          } else {
            s.project.scenes.push(newScene);
          }
          s.project.scenes.forEach((sc, i) => { sc.order = i; });
          s.activeSceneId = newScene.id;
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        deleteScene: (sceneId) => set((s) => {
          if (!s.project || s.project.scenes.length <= 1) return;
          s.project.scenes = s.project.scenes.filter((sc) => sc.id !== sceneId);
          s.project.scenes.forEach((sc, i) => { sc.order = i; });
          if (s.activeSceneId === sceneId) {
            s.activeSceneId = s.project.scenes[0]?.id ?? null;
          }
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        duplicateScene: (sceneId) => set((s) => {
          if (!s.project) return;
          const src = s.project.scenes.find((sc) => sc.id === sceneId);
          if (!src) return;
          const clone: Scene = JSON.parse(JSON.stringify(src));
          clone.id = generateId();
          clone.title = `${src.title} (copy)`;
          clone.elements = clone.elements.map((el) => ({ ...el, id: generateId() }));
          const idx = s.project.scenes.findIndex((sc) => sc.id === sceneId);
          s.project.scenes.splice(idx + 1, 0, clone);
          s.project.scenes.forEach((sc, i) => { sc.order = i; });
          s.activeSceneId = clone.id;
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        reorderScenes: (from, to) => set((s) => {
          if (!s.project) return;
          const [scene] = s.project.scenes.splice(from, 1);
          s.project.scenes.splice(to, 0, scene);
          s.project.scenes.forEach((sc, i) => { sc.order = i; });
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        updateScene: (sceneId, updates) => set((s) => {
          if (!s.project) return;
          const scene = s.project.scenes.find((sc) => sc.id === sceneId);
          if (scene) Object.assign(scene, updates);
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        addElement: (sceneId, element) => set((s) => {
          if (!s.project) return;
          const scene = s.project.scenes.find((sc) => sc.id === sceneId);
          if (!scene) return;
          scene.elements.push(element);
          s.selectedElementIds = [element.id];
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        updateElement: (sceneId, elementId, updates) => set((s) => {
          if (!s.project) return;
          const scene = s.project.scenes.find((sc) => sc.id === sceneId);
          const el = scene?.elements.find((e) => e.id === elementId);
          if (el) Object.assign(el, updates);
          s.isDirty = true;
        }),

        deleteElements: (sceneId, elementIds) => set((s) => {
          if (!s.project) return;
          const scene = s.project.scenes.find((sc) => sc.id === sceneId);
          if (!scene) return;
          scene.elements = scene.elements.filter((e) => !elementIds.includes(e.id));
          s.selectedElementIds = s.selectedElementIds.filter((id) => !elementIds.includes(id));
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        selectElements: (elementIds) => set((s) => { s.selectedElementIds = elementIds; }),
        clearSelection: () => set((s) => { s.selectedElementIds = []; }),

        copyElements: () => set((s) => {
          if (!s.project || !s.activeSceneId) return;
          const scene = s.project.scenes.find((sc) => sc.id === s.activeSceneId);
          if (!scene) return;
          s.clipboardElements = scene.elements.filter((e) => s.selectedElementIds.includes(e.id));
        }),

        pasteElements: () => set((s) => {
          if (!s.project || !s.activeSceneId || s.clipboardElements.length === 0) return;
          const scene = s.project.scenes.find((sc) => sc.id === s.activeSceneId);
          if (!scene) return;
          const pasted = s.clipboardElements.map((e) => ({
            ...JSON.parse(JSON.stringify(e)),
            id: generateId(),
            x: e.x + 20,
            y: e.y + 20,
          }));
          scene.elements.push(...pasted);
          s.selectedElementIds = pasted.map((e) => e.id);
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        bringForward: (sceneId, elementId) => set((s) => {
          if (!s.project) return;
          const scene = s.project.scenes.find((sc) => sc.id === sceneId);
          const el = scene?.elements.find((e) => e.id === elementId);
          if (el) el.zIndex = Math.min(el.zIndex + 1, scene!.elements.length - 1);
          s.isDirty = true;
        }),

        sendBackward: (sceneId, elementId) => set((s) => {
          if (!s.project) return;
          const scene = s.project.scenes.find((sc) => sc.id === sceneId);
          const el = scene?.elements.find((e) => e.id === elementId);
          if (el) el.zIndex = Math.max(el.zIndex - 1, 0);
          s.isDirty = true;
        }),

        updateElementAnimation: (sceneId, elementId, animation) => set((s) => {
          if (!s.project) return;
          const scene = s.project.scenes.find((sc) => sc.id === sceneId);
          const el = scene?.elements.find((e) => e.id === elementId);
          if (el) Object.assign(el.animation, animation);
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        addAudioTrack: (sceneId, track) => set((s) => {
          if (!s.project) return;
          const scene = s.project.scenes.find((sc) => sc.id === sceneId);
          scene?.audioTracks.push(track);
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        updateAudioTrack: (sceneId, trackId, updates) => set((s) => {
          if (!s.project) return;
          const scene = s.project.scenes.find((sc) => sc.id === sceneId);
          const track = scene?.audioTracks.find((t) => t.id === trackId);
          if (track) Object.assign(track, updates);
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        deleteAudioTrack: (sceneId, trackId) => set((s) => {
          if (!s.project) return;
          const scene = s.project.scenes.find((sc) => sc.id === sceneId);
          if (scene) scene.audioTracks = scene.audioTracks.filter((t) => t.id !== trackId);
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        play: () => set((s) => { s.isPlaying = true; }),
        pause: () => set((s) => { s.isPlaying = false; }),
        seek: (time) => set((s) => { s.currentTime = time; }),

        setZoom: (zoom) => set((s) => { s.zoom = Math.min(Math.max(zoom, 0.1), 5); }),
        toggleGrid: () => set((s) => { s.showGrid = !s.showGrid; }),
        toggleSnap: () => set((s) => { s.snapToGrid = !s.snapToGrid; }),
        setPanOffset: (offset) => set((s) => { s.panOffset = offset; }),

        rebuildTimeline: () => set((s) => {
          if (!s.project) return;
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
        }),

        pushHistory: (description) => set((s) => {
          if (!s.project) return;
          const entry: HistoryEntry = {
            scenes: JSON.parse(JSON.stringify(s.project.scenes)),
            timestamp: Date.now(),
            description,
          };
          s.history = s.history.slice(0, s.historyIndex + 1);
          s.history.push(entry);
          if (s.history.length > MAX_HISTORY) s.history.shift();
          s.historyIndex = s.history.length - 1;
        }),

        undo: () => set((s) => {
          if (!s.project || s.historyIndex <= 0) return;
          s.historyIndex -= 1;
          s.project.scenes = JSON.parse(JSON.stringify(s.history[s.historyIndex].scenes));
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        redo: () => set((s) => {
          if (!s.project || s.historyIndex >= s.history.length - 1) return;
          s.historyIndex += 1;
          s.project.scenes = JSON.parse(JSON.stringify(s.history[s.historyIndex].scenes));
          s.timelineTracks = buildTimelineTracks(s.project.scenes);
          s.isDirty = true;
        }),

        setActiveExportJob: (job) => set((s) => { s.activeExportJob = job; }),
      }))
    ),
    { name: 'EditorStore' }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectActiveScene = (s: EditorState) =>
  s.project?.scenes.find((sc) => sc.id === s.activeSceneId) ?? null;

export const selectSelectedElements = (s: EditorState) => {
  const scene = selectActiveScene(s);
  return scene?.elements.filter((e) => s.selectedElementIds.includes(e.id)) ?? [];
};

export const selectTotalDuration = (s: EditorState) =>
  s.project?.scenes.reduce((acc, sc) => acc + sc.duration + sc.transitionDuration, 0) ?? 0;

export const selectCanUndo = (s: EditorState) => s.historyIndex > 0;
export const selectCanRedo = (s: EditorState) => s.historyIndex < s.history.length - 1;
