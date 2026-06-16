'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ScriptGenerationRequest, GeneratedScript, Industry } from '@/types';

const schema = z.object({
  topic: z.string().min(3, 'Topic must be at least 3 characters'),
  industry: z.enum(['business', 'education', 'healthcare', 'oil-gas', 'engineering', 'marketing']),
  audience: z.string().min(3),
  durationSeconds: z.number().min(30).max(1800),
  tone: z.enum(['professional', 'casual', 'educational', 'persuasive']),
  language: z.string().default('en'),
});

type FormValues = z.infer<typeof schema>;

interface ScriptGeneratorProps {
  onScriptGenerated: (script: GeneratedScript) => void;
  onClose: () => void;
}

export function ScriptGenerator({ onScriptGenerated, onClose }: ScriptGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      industry: 'business',
      durationSeconds: 120,
      tone: 'professional',
      language: 'en',
    },
  });

  const durationSecs = watch('durationSeconds');

  const onSubmit = async (values: FormValues) => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) throw new Error(await res.text());
      const script: GeneratedScript = await res.json();
      setGeneratedScript(script);
    } catch (e: any) {
      setError(e.message ?? 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseScript = () => {
    if (generatedScript) {
      onScriptGenerated(generatedScript);
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">AI Script Generator</h2>
          <p className="text-sm text-gray-500 mt-0.5">Generate a complete doodle video script with scenes</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Form */}
        <div className="w-80 flex-shrink-0 p-4 border-r border-gray-200 overflow-y-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic *</label>
              <textarea
                {...register('topic')}
                rows={3}
                placeholder="e.g. How to prevent a well blowout during drilling operations"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
              {errors.topic && <p className="text-xs text-red-500 mt-1">{errors.topic.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <select {...register('industry')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="business">Business</option>
                <option value="education">Education</option>
                <option value="healthcare">Healthcare</option>
                <option value="oil-gas">Oil &amp; Gas</option>
                <option value="engineering">Engineering</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience *</label>
              <input
                {...register('audience')}
                type="text"
                placeholder="e.g. Offshore drilling crew, new hires"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
              {errors.audience && <p className="text-xs text-red-500 mt-1">{errors.audience.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration: <span className="font-semibold text-indigo-600">{formatDuration(durationSecs)}</span>
              </label>
              <input
                {...register('durationSeconds', { valueAsNumber: true })}
                type="range" min={30} max={1800} step={30}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>30s</span><span>15m</span><span>30m</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
              <div className="grid grid-cols-2 gap-2">
                {(['professional', 'casual', 'educational', 'persuasive'] as const).map((tone) => (
                  <label key={tone} className="flex items-center gap-2 cursor-pointer">
                    <input {...register('tone')} type="radio" value={tone} className="accent-indigo-500"/>
                    <span className="text-sm capitalize">{tone}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select {...register('language')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="pt">Portuguese</option>
              </select>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Generating...
                </>
              ) : 'Generate Script'}
            </button>
          </form>
        </div>

        {/* Result */}
        <div className="flex-1 overflow-y-auto p-4">
          {!generatedScript && !isGenerating && (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
              <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              <p className="text-sm font-medium">Your script will appear here</p>
              <p className="text-xs mt-1">Fill in the form and click Generate Script</p>
            </div>
          )}

          {isGenerating && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"/>
              <p className="text-sm font-medium text-gray-700">AI is crafting your script...</p>
              <p className="text-xs text-gray-500 mt-1">This usually takes 10-30 seconds</p>
            </div>
          )}

          {generatedScript && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{generatedScript.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {generatedScript.scenes.length} scenes · {formatDuration(generatedScript.totalDuration)}
                  </p>
                </div>
                <button
                  onClick={handleUseScript}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
                >
                  Use This Script
                </button>
              </div>

              {/* Voiceover */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Full Voiceover Script</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{generatedScript.voiceoverText}</p>
              </div>

              {/* Scenes */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scenes</h4>
                {generatedScript.scenes.map((scene) => (
                  <div key={scene.order} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                        {scene.order}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{scene.title}</span>
                      <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {formatDuration(scene.duration)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{scene.description}</p>
                    {scene.suggestedAssets.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {scene.suggestedAssets.map((a) => (
                          <span key={a} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
