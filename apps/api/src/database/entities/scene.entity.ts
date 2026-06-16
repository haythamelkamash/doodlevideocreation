import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ProjectEntity } from './project.entity';

@Entity('scenes')
@Index(['projectId', 'order'])
export class SceneEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ default: 0 })
  order: number;

  @Column({ length: 255 })
  title: string;

  @Column({ name: 'duration_seconds', type: 'float', default: 5 })
  durationSeconds: number;

  @Column({ name: 'transition_type', default: 'fade' })
  transitionType: string;

  @Column({ name: 'transition_duration', type: 'float', default: 0.5 })
  transitionDuration: number;

  @Column({ type: 'jsonb', default: '[]' })
  elements: Record<string, any>[]; // SceneElement[]

  @Column({ name: 'audio_tracks', type: 'jsonb', default: '[]' })
  audioTracks: Record<string, any>[];

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string | null;

  @Column({ name: 'background_override', type: 'jsonb', nullable: true })
  backgroundOverride: Record<string, any> | null;

  @ManyToOne(() => ProjectEntity, (p) => p.scenes, { onDelete: 'CASCADE' })
  project: ProjectEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
