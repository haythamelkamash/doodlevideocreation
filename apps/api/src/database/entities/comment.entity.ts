import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ProjectEntity } from './project.entity';
import { UserEntity } from './user.entity';

@Entity('comments')
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'scene_id', nullable: true })
  sceneId: string | null;

  @Column({ name: 'element_id', nullable: true })
  elementId: string | null;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string | null;

  @Column({ name: 'author_id' })
  authorId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: false })
  resolved: boolean;

  @Column({ name: 'timecode_seconds', type: 'float', nullable: true })
  timecodeSeconds: number | null;

  @ManyToOne(() => ProjectEntity, (p) => p.comments, { onDelete: 'CASCADE' })
  project: ProjectEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  author: UserEntity;

  @ManyToOne(() => CommentEntity, (c) => c.replies, { nullable: true, onDelete: 'CASCADE' })
  parent: CommentEntity | null;

  @OneToMany(() => CommentEntity, (c) => c.parent)
  replies: CommentEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
