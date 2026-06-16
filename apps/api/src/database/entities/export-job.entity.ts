import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ProjectEntity } from './project.entity';
import { UserEntity } from './user.entity';

@Entity('export_jobs')
@Index(['projectId', 'createdAt'])
@Index(['status'])
export class ExportJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ default: 'mp4' })
  format: string; // ExportFormat

  @Column({ default: '1080p' })
  quality: string; // ExportQuality

  @Column({ default: 'queued' })
  status: string; // ExportStatus

  @Column({ type: 'float', default: 0 })
  progress: number;

  @Column({ name: 'output_url', nullable: true })
  outputUrl: string | null;

  @Column({ name: 'output_size_bytes', type: 'bigint', nullable: true })
  outputSizeBytes: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'worker_id', nullable: true })
  workerId: string | null;

  @Column({ name: 'bull_job_id', nullable: true })
  bullJobId: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @ManyToOne(() => ProjectEntity, (p) => p.exportJobs, { onDelete: 'CASCADE' })
  project: ProjectEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
