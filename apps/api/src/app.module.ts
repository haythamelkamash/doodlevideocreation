import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { redisStore } from 'cache-manager-redis-yet';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ScenesModule } from './modules/scenes/scenes.module';
import { AssetsModule } from './modules/assets/assets.module';
import { ExportModule } from './modules/export/export.module';
import { AudioModule } from './modules/audio/audio.module';
import { AiModule } from './modules/ai/ai.module';
import { BillingModule } from './modules/billing/billing.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { TeamsModule } from './modules/teams/teams.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OilGasModule } from './modules/oil-gas/oil-gas.module';

import { UserEntity } from './database/entities/user.entity';
import { ProjectEntity } from './database/entities/project.entity';
import { SceneEntity } from './database/entities/scene.entity';
import { ExportJobEntity } from './database/entities/export-job.entity';
import { CommentEntity } from './database/entities/comment.entity';

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),

    // ── Database ─────────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow('DATABASE_URL'),
        entities: [UserEntity, ProjectEntity, SceneEntity, ExportJobEntity, CommentEntity],
        migrations: [join(__dirname, 'database/migrations/**/*.js')],
        migrationsRun: true,
        ssl: config.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
        poolSize: 20,
        logging: config.get('NODE_ENV') === 'development' ? ['error'] : false,
      }),
    }),

    // ── Cache (Redis) ────────────────────────────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({ socket: { host: config.get('REDIS_HOST', 'localhost'), port: config.get('REDIS_PORT', 6379) }, password: config.get('REDIS_PASSWORD') }),
        ttl: 60_000,
      }),
    }),

    // ── Bull Queues ──────────────────────────────────────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: { host: config.get('REDIS_HOST', 'localhost'), port: config.get('REDIS_PORT', 6379), password: config.get('REDIS_PASSWORD') },
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 50 },
      }),
    }),

    // ── Rate Limiting ─────────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: 1000, limit: 10 },
          { name: 'medium', ttl: 60_000, limit: 200 },
          { name: 'long', ttl: 3_600_000, limit: 5000 },
        ],
        storage: undefined, // uses Redis via CacheModule in production
      }),
    }),

    // ── GraphQL ───────────────────────────────────────────────────────────────
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      subscriptions: { 'graphql-ws': true },
      context: ({ req, res }) => ({ req, res }),
    }),

    // ── Event Emitter ─────────────────────────────────────────────────────────
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 20 }),

    // ── Scheduler ────────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Feature Modules ───────────────────────────────────────────────────────
    AuthModule,
    ProjectsModule,
    ScenesModule,
    AssetsModule,
    ExportModule,
    AudioModule,
    AiModule,
    BillingModule,
    TemplatesModule,
    TeamsModule,
    AdminModule,
    NotificationsModule,
    OilGasModule,
  ],
})
export class AppModule {}
