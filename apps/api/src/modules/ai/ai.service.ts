import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { GeneratedScript, ScriptGenerationRequest, Industry } from 'shared-types';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({ apiKey: config.getOrThrow('OPENAI_API_KEY') });
  }

  // ── Script Generation ─────────────────────────────────────────────────────

  async generateScript(req: ScriptGenerationRequest): Promise<GeneratedScript> {
    const systemPrompt = this.buildSystemPrompt(req.industry);
    const userPrompt = this.buildScriptPrompt(req);

    this.logger.log(`Generating script for topic="${req.topic}" industry=${req.industry}`);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(raw);
    return this.validateAndMapScript(parsed, req);
  }

  // ── TTS Generation ────────────────────────────────────────────────────────

  async generateVoiceover(text: string, voice: string = 'alloy', speed: number = 1.0): Promise<Buffer> {
    this.logger.log(`Generating TTS voiceover, voice=${voice}, chars=${text.length}`);

    const response = await this.openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: voice as any,
      input: text,
      speed,
      response_format: 'mp3',
    });

    return Buffer.from(await response.arrayBuffer());
  }

  // ── Image Generation ──────────────────────────────────────────────────────

  async generateDoodleImage(prompt: string, style: 'whiteboard' | 'minimal' = 'whiteboard'): Promise<string> {
    const enhancedPrompt = `${style === 'whiteboard' ? 'Clean whiteboard doodle illustration, black lines on white background, hand-drawn style,' : 'Minimal line art,'} ${prompt}, simple and clear, suitable for educational video`;

    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural',
    });

    const url = response.data[0]?.url;
    if (!url) throw new Error('No image URL returned');
    return url;
  }

  // ── Scene Suggestions ─────────────────────────────────────────────────────

  async suggestSceneAssets(sceneDescription: string, industry: Industry): Promise<{
    characters: string[];
    props: string[];
    animations: string[];
    backgroundSuggestion: string;
  }> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert in doodle video production for the ${industry} industry. Return JSON with keys: characters (array of character type names), props (array of prop/asset names), animations (array of animation suggestions), backgroundSuggestion (string).`,
        },
        {
          role: 'user',
          content: `Suggest visual assets for this scene: "${sceneDescription}"`,
        },
      ],
    });

    return JSON.parse(response.choices[0]?.message?.content ?? '{}');
  }

  // ── Oil & Gas Specific ────────────────────────────────────────────────────

  async generateOilGasTrainingScript(scenario: string, certificationLevel: string): Promise<GeneratedScript> {
    const req: ScriptGenerationRequest = {
      topic: scenario,
      industry: 'oil-gas',
      audience: `Drilling personnel at ${certificationLevel} level`,
      durationSeconds: 300, // 5 min default for O&G training
      tone: 'professional',
      language: 'en',
    };

    return this.generateScript(req);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildSystemPrompt(industry: Industry): string {
    const industryContext: Partial<Record<Industry, string>> = {
      'oil-gas': `You are an expert doodle video scriptwriter specializing in Oil & Gas training content.
        You have deep knowledge of: well control procedures (IADC/IWCF standards), managed pressure drilling (MPD),
        blowout prevention (BOP) operations, kick detection and response, drilling operations,
        process safety management (PSM), and emergency response procedures.
        Use precise technical terminology while keeping explanations clear for field personnel.`,
      'healthcare': 'You are an expert doodle video scriptwriter for healthcare training and patient education.',
      'education': 'You are an expert doodle video scriptwriter for educational content.',
    };

    const basePrompt = industryContext[industry] ?? 'You are an expert doodle video scriptwriter for corporate training.';

    return `${basePrompt}

Your output must be valid JSON with this exact structure:
{
  "title": "string",
  "script": "string (full narrative script)",
  "voiceoverText": "string (clean text for TTS, no stage directions)",
  "totalDuration": number (seconds),
  "scenes": [
    {
      "order": number,
      "title": "string",
      "description": "string (visual description for animator)",
      "duration": number (seconds),
      "suggestedCharacters": ["string"],
      "suggestedAssets": ["string"],
      "animationSuggestions": ["string"],
      "voiceoverSegment": "string"
    }
  ]
}`;
  }

  private buildScriptPrompt(req: ScriptGenerationRequest): string {
    const mins = Math.floor(req.durationSeconds / 60);
    const secs = req.durationSeconds % 60;
    const durationStr = mins > 0 ? `${mins} minute${mins > 1 ? 's' : ''} ${secs > 0 ? `${secs} seconds` : ''}` : `${secs} seconds`;

    return `Create a doodle whiteboard animation video script with the following specifications:

Topic: ${req.topic}
Industry: ${req.industry}
Target Audience: ${req.audience}
Duration: ${durationStr} (${req.durationSeconds} seconds total)
Tone: ${req.tone}
Language: ${req.language}

Requirements:
- Break the content into logical scenes (aim for 30-60 seconds per scene)
- Each scene should have clear visual descriptions suitable for whiteboard animation
- The voiceover should sync naturally with the visual storytelling
- Use the hand-draw whiteboard animation format in mind (elements appear one by one)
- Include specific animation suggestions for each scene
- Suggest appropriate characters, props, and visual assets for each scene

Generate the complete script now.`;
  }

  private validateAndMapScript(parsed: any, req: ScriptGenerationRequest): GeneratedScript {
    return {
      title: parsed.title ?? req.topic,
      script: parsed.script ?? '',
      voiceoverText: parsed.voiceoverText ?? '',
      totalDuration: parsed.totalDuration ?? req.durationSeconds,
      scenes: (parsed.scenes ?? []).map((s: any, i: number) => ({
        order: s.order ?? i + 1,
        title: s.title ?? `Scene ${i + 1}`,
        description: s.description ?? '',
        duration: s.duration ?? 30,
        suggestedCharacters: s.suggestedCharacters ?? [],
        suggestedAssets: s.suggestedAssets ?? [],
        animationSuggestions: s.animationSuggestions ?? [],
        voiceoverSegment: s.voiceoverSegment ?? '',
      })),
    };
  }
}
