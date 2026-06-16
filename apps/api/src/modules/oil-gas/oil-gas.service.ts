/**
 * Oil & Gas Training Module
 * Provides domain-specific content generation, asset management, and training
 * templates for well control, MPD, drilling operations, and safety scenarios.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import type { OilGasTrainingModule, OilGasScenarioType, Template } from 'shared-types';

// ─── Scenario Registry ────────────────────────────────────────────────────────

const OIL_GAS_SCENARIOS: Record<OilGasScenarioType, {
  title: string;
  description: string;
  learningObjectives: string[];
  certificationLevel: string;
  regulatoryReferences: string[];
  defaultDurationSeconds: number;
  keyAnimationElements: string[];
}> = {
  'well-control': {
    title: 'Well Control Fundamentals',
    description: 'Core well control principles, pressure management, and kick response procedures',
    learningObjectives: [
      'Understand hydrostatic pressure and formation pressure balance',
      'Identify early kick indicators',
      'Execute correct well shut-in procedures (soft/hard shut-in)',
      'Apply the driller\'s method and wait-and-weight method',
      'Calculate kill mud weight and circulating pressures',
    ],
    certificationLevel: 'operator',
    regulatoryReferences: ['IADC WellCAP', 'IWCF Level 2/3', 'API RP 59', 'NORSOK D-010'],
    defaultDurationSeconds: 480,
    keyAnimationElements: [
      'wellbore_cross_section', 'mud_column', 'formation_pressure_arrows',
      'bop_stack', 'choke_manifold', 'drill_string', 'annulus_flow',
    ],
  },
  'blowout-prevention': {
    title: 'Blowout Prevention (BOP) Operations',
    description: 'BOP equipment types, testing, and emergency activation procedures',
    learningObjectives: [
      'Identify all BOP components and their functions',
      'Understand BOP testing frequency and acceptance criteria',
      'Execute emergency BOP closure sequence',
      'Interpret BOP control panel indicators',
      'Understand shear ram operation and limitations',
    ],
    certificationLevel: 'operator',
    regulatoryReferences: ['API 16A', 'API 16D', 'API 53', 'BSEE 30 CFR Part 250'],
    defaultDurationSeconds: 360,
    keyAnimationElements: [
      'annular_bop', 'blind_shear_rams', 'pipe_rams', 'accumulator_unit',
      'bop_control_panel', 'kill_choke_lines', 'wellhead_assembly',
    ],
  },
  'managed-pressure-drilling': {
    title: 'Managed Pressure Drilling (MPD)',
    description: 'MPD concepts, equipment, and operational procedures for narrow pressure windows',
    learningObjectives: [
      'Understand the difference between conventional and MPD',
      'Identify the four main MPD methods (CBHP, HSM, DGD, Pressurized Mud Cap)',
      'Operate rotating control device (RCD)',
      'Interpret MPD flow-in/flow-out measurements',
      'Respond to MPD system alarms and anomalies',
    ],
    certificationLevel: 'engineer',
    regulatoryReferences: ['IADC MPD Committee Guidelines', 'API RP 92M', 'SPE 108357'],
    defaultDurationSeconds: 600,
    keyAnimationElements: [
      'rcd_assembly', 'mpd_choke_manifold', 'coriolis_flow_meter',
      'trip_tank', 'backpressure_pump', 'pressure_window_diagram',
      'equivalent_circulating_density_graph',
    ],
  },
  'drilling-operations': {
    title: 'Drilling Operations Overview',
    description: 'End-to-end drilling process from spud to TD',
    learningObjectives: [
      'Understand the drilling program and well plan',
      'Identify rotary drilling system components',
      'Monitor drilling parameters (WOB, RPM, torque, flow rate)',
      'Recognize abnormal drilling indicators',
      'Follow connection and trip procedures',
    ],
    certificationLevel: 'awareness',
    regulatoryReferences: ['API RP 7G', 'IADC Drilling Manual'],
    defaultDurationSeconds: 420,
    keyAnimationElements: [
      'drill_floor_layout', 'top_drive', 'kelly_bushing', 'drill_bit',
      'derrick', 'mud_system', 'drillstring_animation', 'formation_layers',
    ],
  },
  'equipment-illustration': {
    title: 'Drilling Equipment Identification',
    description: 'Visual identification and function of all major drilling equipment',
    learningObjectives: [
      'Identify surface and subsurface drilling equipment',
      'Understand equipment operating envelopes and limitations',
      'Recognize equipment failure indicators',
    ],
    certificationLevel: 'awareness',
    regulatoryReferences: ['OEM manuals', 'API equipment standards'],
    defaultDurationSeconds: 300,
    keyAnimationElements: [
      'rig_overview', 'surface_equipment_callouts', 'downhole_tools',
      'mud_pumps', 'solids_control_equipment',
    ],
  },
  'process-flow': {
    title: 'Drilling Fluid Circulation System',
    description: 'Mud system design, properties, and circulation process',
    learningObjectives: [
      'Trace the complete mud circulation path',
      'Understand mud properties and their functions',
      'Identify solids control equipment sequence',
      'Monitor mud pit levels and flow returns',
    ],
    certificationLevel: 'operator',
    regulatoryReferences: ['API RP 13B', 'IADC Mud Logging'],
    defaultDurationSeconds: 360,
    keyAnimationElements: [
      'mud_pit_system', 'centrifugal_pumps', 'mud_return_line',
      'shale_shakers', 'desilter', 'desander', 'centrifuge',
      'suction_pit_arrows', 'flow_meter',
    ],
  },
  'safety-emergency-response': {
    title: 'Emergency Response on the Rig',
    description: 'Muster stations, emergency signals, firefighting, and evacuation procedures',
    learningObjectives: [
      'Identify muster stations and emergency routes',
      'Respond to emergency alarm signals correctly',
      'Don personal protective equipment for emergencies',
      'Execute lifeboat and life raft deployment',
      'Perform basic firefighting using rig equipment',
    ],
    certificationLevel: 'awareness',
    regulatoryReferences: ['SOLAS', 'MODU Code', 'OPITO BOSIET', 'MARPOL'],
    defaultDurationSeconds: 480,
    keyAnimationElements: [
      'rig_muster_map', 'emergency_alarm_panel', 'lifeboats',
      'fire_extinguisher_types', 'evacuation_routes', 'survival_suits',
      'emergency_shutdown_buttons',
    ],
  },
  'kick-detection': {
    title: 'Kick Detection and Early Warning',
    description: 'Identifying a well kick before it becomes a blowout',
    learningObjectives: [
      'Monitor primary kick indicators (flow rate increase, pit gain)',
      'Recognize secondary kick indicators',
      'Differentiate between kick and other wellbore events',
      'Respond to kick indicators within the golden minute',
      'Use trip sheet and flow checks correctly',
    ],
    certificationLevel: 'operator',
    regulatoryReferences: ['IADC WellCAP', 'IWCF Level 2', 'API RP 59 Section 5'],
    defaultDurationSeconds: 420,
    keyAnimationElements: [
      'pit_volume_totalizer', 'flow_indicator', 'mud_logger_panel',
      'trip_tank_animation', 'flow_check_procedure', 'shut_in_sequence',
      'pit_gain_graph',
    ],
  },
  'well-completion': {
    title: 'Well Completion Operations',
    description: 'Completion design, perforation, and production readiness',
    learningObjectives: [
      'Understand open-hole vs cased-hole completion',
      'Identify completion equipment components',
      'Follow perforation safety procedures',
      'Execute tubing running and wellhead completion',
    ],
    certificationLevel: 'engineer',
    regulatoryReferences: ['API 11V7', 'API 11AX', 'SPE completion standards'],
    defaultDurationSeconds: 540,
    keyAnimationElements: [
      'production_tubing', 'packer_animation', 'perforating_gun',
      'wellhead_xmas_tree', 'subsurface_safety_valve', 'gravel_pack',
    ],
  },
};

@Injectable()
export class OilGasService {
  private readonly logger = new Logger(OilGasService.name);

  constructor(private readonly aiService: AiService) {}

  // ── Module Catalog ────────────────────────────────────────────────────────

  getAvailableModules(): OilGasTrainingModule[] {
    return Object.entries(OIL_GAS_SCENARIOS).map(([type, config]) => ({
      id: `oilgas-${type}`,
      title: config.title,
      scenarioType: type as OilGasScenarioType,
      description: config.description,
      learningObjectives: config.learningObjectives,
      assets: [], // populated from asset library
      templates: [],
      certificationLevel: config.certificationLevel as any,
      regulatoryReferences: config.regulatoryReferences,
    }));
  }

  getModuleByScenario(scenario: OilGasScenarioType) {
    const config = OIL_GAS_SCENARIOS[scenario];
    if (!config) throw new Error(`Unknown O&G scenario: ${scenario}`);
    return { scenario, ...config };
  }

  // ── AI Script Generation ──────────────────────────────────────────────────

  async generateTrainingScript(scenario: OilGasScenarioType, customOptions?: {
    audience?: string;
    durationSeconds?: number;
    language?: string;
    specificFocus?: string;
  }) {
    const config = OIL_GAS_SCENARIOS[scenario];
    if (!config) throw new Error(`Unknown O&G scenario: ${scenario}`);

    const topic = customOptions?.specificFocus
      ? `${config.title}: ${customOptions.specificFocus}`
      : config.title;

    this.logger.log(`Generating O&G training script for scenario=${scenario}`);

    return this.aiService.generateScript({
      topic,
      industry: 'oil-gas',
      audience: customOptions?.audience ?? `Offshore drilling crew - ${config.certificationLevel} level`,
      durationSeconds: customOptions?.durationSeconds ?? config.defaultDurationSeconds,
      tone: 'professional',
      language: customOptions?.language ?? 'en',
    });
  }

  // ── Animation Element Suggestions ─────────────────────────────────────────

  getAnimationElements(scenario: OilGasScenarioType): string[] {
    return OIL_GAS_SCENARIOS[scenario]?.keyAnimationElements ?? [];
  }

  // ── Regulatory Compliance Tags ────────────────────────────────────────────

  getRegulatoryReferences(scenario: OilGasScenarioType): string[] {
    return OIL_GAS_SCENARIOS[scenario]?.regulatoryReferences ?? [];
  }

  // ── Quiz Generation ───────────────────────────────────────────────────────

  async generateTrainingQuiz(scenario: OilGasScenarioType, questionCount: number = 10) {
    const config = OIL_GAS_SCENARIOS[scenario];

    const response = await this.aiService['openai'].chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert in Oil & Gas training assessments. Generate multiple choice quiz questions based on regulatory standards: ${config.regulatoryReferences.join(', ')}.
Return JSON: { "questions": [{ "question": "string", "options": ["A...", "B...", "C...", "D..."], "correctAnswer": 0, "explanation": "string", "learningObjective": "string" }] }`,
        },
        {
          role: 'user',
          content: `Generate ${questionCount} quiz questions for: "${config.title}".
Learning objectives: ${config.learningObjectives.join('; ')}.
Mix difficulty levels. Include scenario-based questions.`,
        },
      ],
    });

    return JSON.parse(response.choices[0]?.message?.content ?? '{"questions":[]}');
  }
}
