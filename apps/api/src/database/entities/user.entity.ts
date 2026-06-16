import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
  CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate, Index,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ProjectEntity } from './project.entity';

@Entity('users')
@Index(['email'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'password_hash', nullable: true, select: false })
  passwordHash: string | null;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ default: 'editor' })
  role: string; // UserRole

  @Column({ default: 'free' })
  plan: string; // PlanTier

  @Column({ name: 'team_id', nullable: true })
  teamId: string | null;

  @Column({ name: 'stripe_customer_id', nullable: true })
  stripeCustomerId: string | null;

  @Column({ name: 'stripe_subscription_id', nullable: true })
  stripeSubscriptionId: string | null;

  @Column({ name: 'google_id', nullable: true })
  googleId: string | null;

  @Column({ name: 'microsoft_id', nullable: true })
  microsoftId: string | null;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'ai_credits_used', default: 0 })
  aiCreditsUsed: number;

  @Column({ type: 'jsonb', default: '{}' })
  preferences: Record<string, any>;

  @OneToMany(() => ProjectEntity, (p) => p.owner)
  projects: ProjectEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.passwordHash && !this.passwordHash.startsWith('$2b$')) {
      this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
    }
  }

  async validatePassword(plain: string): Promise<boolean> {
    if (!this.passwordHash) return false;
    return bcrypt.compare(plain, this.passwordHash);
  }
}
