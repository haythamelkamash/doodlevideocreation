'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as fabric from 'fabric';
import { useEditorStore, selectActiveScene } from '@/stores/editor.store';
import type { SceneElement } from '@/types';

const SNAP_THRESHOLD = 10;

interface DoodleCanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export function DoodleCanvas({ width = 1920, height = 1080, className }: DoodleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    zoom, showGrid, snapToGrid, gridSize, selectedElementIds,
    updateElement, selectElements, clearSelection, addElement,
    activeSceneId, pushHistory,
  } = useEditorStore();

  const activeScene = useEditorStore(selectActiveScene);

  // ── Canvas Init ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
      renderOnAddRemove: true,
    });

    fabricRef.current = canvas;

    // Selection events
    canvas.on('selection:created', (e) => {
      const ids = (e.selected ?? []).map((obj: fabric.Object) => (obj as any).elementId as string).filter(Boolean);
      selectElements(ids);
    });

    canvas.on('selection:updated', (e) => {
      const ids = (e.selected ?? []).map((obj: fabric.Object) => (obj as any).elementId as string).filter(Boolean);
      selectElements(ids);
    });

    canvas.on('selection:cleared', () => clearSelection());

    // Object modified — persist back to store
    canvas.on('object:modified', (e) => {
      const obj = e.target as any;
      if (!obj?.elementId || !activeSceneId) return;
      pushHistory('Move/resize element');
      updateElement(activeSceneId, obj.elementId, {
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round((obj.width ?? 0) * (obj.scaleX ?? 1)),
        height: Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
        rotation: Math.round(obj.angle ?? 0),
      });
    });

    // Grid snapping
    canvas.on('object:moving', (e) => {
      if (!snapToGrid) return;
      const obj = e.target;
      if (!obj) return;
      obj.set({
        left: Math.round((obj.left ?? 0) / gridSize) * gridSize,
        top: Math.round((obj.top ?? 0) / gridSize) * gridSize,
      });
    });

    return () => canvas.dispose();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Zoom ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setZoom(zoom);
    canvas.setWidth(width * zoom);
    canvas.setHeight(height * zoom);
    canvas.renderAll();
  }, [zoom, width, height]);

  // ── Grid ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Remove existing grid objects
    const existingGrid = canvas.getObjects().filter((o: any) => o.isGrid);
    existingGrid.forEach((o) => canvas.remove(o));

    if (!showGrid) {
      canvas.renderAll();
      return;
    }

    for (let x = 0; x <= width; x += gridSize) {
      const line = new fabric.Line([x, 0, x, height], {
        stroke: '#e5e7eb', strokeWidth: 1, selectable: false, evented: false,
      });
      (line as any).isGrid = true;
      canvas.add(line);
      canvas.sendObjectToBack(line);
    }

    for (let y = 0; y <= height; y += gridSize) {
      const line = new fabric.Line([0, y, width, y], {
        stroke: '#e5e7eb', strokeWidth: 1, selectable: false, evented: false,
      });
      (line as any).isGrid = true;
      canvas.add(line);
      canvas.sendObjectToBack(line);
    }

    canvas.renderAll();
  }, [showGrid, gridSize, width, height]);

  // ── Sync scene elements → Fabric objects ─────────────────────────────────

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !activeScene) return;

    // Remove non-grid objects
    const toRemove = canvas.getObjects().filter((o: any) => !o.isGrid);
    toRemove.forEach((o) => canvas.remove(o));

    // Render each element
    for (const el of [...activeScene.elements].sort((a, b) => a.zIndex - b.zIndex)) {
      addFabricObject(canvas, el);
    }

    canvas.renderAll();
  }, [activeScene?.id, activeScene?.elements.length]); // re-sync on scene change or element count change

  function addFabricObject(canvas: fabric.Canvas, el: SceneElement) {
    const common = {
      left: el.x, top: el.y, angle: el.rotation, opacity: el.opacity,
      selectable: true, evented: true,
    } as Partial<fabric.Object>;

    switch (el.type) {
      case 'text': {
        const text = new fabric.Textbox(el.content ?? '', {
          ...common, width: el.width, fontSize: 32,
          fontFamily: 'Inter, sans-serif', fill: '#1f2937',
        });
        (text as any).elementId = el.id;
        canvas.add(text);
        break;
      }
      case 'image':
      case 'character':
      case 'icon': {
        fabric.Image.fromURL(el.src ?? '', (img) => {
          img.set({ ...common, scaleX: el.width / (img.width ?? 1), scaleY: el.height / (img.height ?? 1) });
          (img as any).elementId = el.id;
          canvas.add(img);
          canvas.renderAll();
        });
        break;
      }
      case 'shape': {
        const rect = new fabric.Rect({
          ...common, width: el.width, height: el.height, fill: '#6366f1', rx: 8, ry: 8,
        });
        (rect as any).elementId = el.id;
        canvas.add(rect);
        break;
      }
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const canvas = fabricRef.current;
      if (!canvas) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        canvas.discardActiveObject();
        const sel = new fabric.ActiveSelection(
          canvas.getObjects().filter((o: any) => !o.isGrid),
          { canvas }
        );
        canvas.setActiveObject(sel);
        canvas.renderAll();
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = canvas.getActiveObjects();
        if (active.length && activeSceneId) {
          const ids = active.map((o: any) => o.elementId).filter(Boolean) as string[];
          active.forEach((o) => canvas.remove(o));
          canvas.discardActiveObject();
          canvas.renderAll();
          useEditorStore.getState().deleteElements(activeSceneId, ids);
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'c') useEditorStore.getState().copyElements();
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') useEditorStore.getState().pasteElements();
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') useEditorStore.getState().undo();
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) useEditorStore.getState().redo();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeSceneId]);

  // ── Drop assets onto canvas ───────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data || !activeSceneId) return;
    try {
      const asset = JSON.parse(data);
      const rect = canvasRef.current?.getBoundingClientRect();
      const x = rect ? (e.clientX - rect.left) / zoom : 100;
      const y = rect ? (e.clientY - rect.top) / zoom : 100;

      const newEl: SceneElement = {
        id: `el-${Date.now()}`,
        type: asset.category === 'character' ? 'character' : 'image',
        assetId: asset.id,
        src: asset.url,
        x: Math.round(x), y: Math.round(y),
        width: 200, height: 200,
        rotation: 0, opacity: 1, zIndex: 99,
        animation: {
          type: 'draw', drawEffect: 'pencil', handType: 'right',
          startTime: 0, duration: 2, delay: 0, speed: 1, easing: 'ease-in-out',
        },
      };
      addElement(activeSceneId, newEl);
    } catch {}
  }, [activeSceneId, zoom, addElement]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-100 ${className ?? ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
