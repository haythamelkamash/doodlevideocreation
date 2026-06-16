import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { SceneEntity } from './scene.entity';
import { ExportJobEntity } from './export-job.entity';
import { CommentEntity } from './comment.entity';

@Entity('projects')
@Index(['ownerId', 'createdAt'])
@Index(['teamId', 'createdAt'])
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string | null;

  @Column({ name: 'duration_seconds', type: 'float', default: 0 })
  durationSeconds: number;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'team_id', nullable: true })
  teamId: string | null;

  @Column({ name: 'is_draft', default: true })
  isDraft: boolean;

  @Column({ name: 'export_status', default: 'idle' })
  exportStatus: string;

  @Column({ name: 'last_exported_at', type: 'timestamptz', nullable: true })
  lastExportedAt: Date | null;

  @Column({ type: 'jsonb', default: '{}' })
  settings: Record<string, any>;

  @Column({ name: 'canvas_width', default: 1920 })
  canvasWidth: number;

  @Column({ name: 'canvas_height', default: 1080 })
  canvasHeight: number;

  @Column({ name: 'background_type', default: 'whiteboard' })
  backgroundType: string;

  @Column({ name: 'background_color', default: '#ffffff' })
  backgroundColor: string;

  @Column({ name: 'background_image_url', nullable: true })
  backgroundImageUrl: string | null;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  @ManyToOne(() => UserEntity, (u) => u.projects, { onDelete: 'CASCADE' })
  owner: UserEntity;

  @OneToMany(() => SceneEntity, (s) => s.project, { cascade: true, eager: false })
  scenes: SceneEntity[];

  @OneToMany(() => ExportJobEntity, (e) => e.project)
  exportJobs: ExportJobEntity[];

  @OneToMany(() => CommentEntity, (c) => c.project)
  comments: CommentEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
