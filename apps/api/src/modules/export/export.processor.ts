import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ExportJobEntity } from '../../database/entities/export-job.entity';

export interface ExportJobPayload {
  exportJobId: string;
  projectId: string;
  userId: string;
  format: 'mp4' | 'mov' | 'webm' | 'gif';
  quality: '720p' | '1080p' | '4k';
}

const QUALITY_MAP = {
  '720p': { width: 1280, height: 720, videoBitrate: '3000k', audioBitrate: '128k' },
  '1080p': { width: 1920, height: 1080, videoBitrate: '8000k', audioBitrate: '192k' },
  '4k': { width: 3840, height: 2160, videoBitrate: '35000k', audioBitrate: '256k' },
};

@Processor('export')
export class ExportProcessor {
  private readonly logger = new Logger(ExportProcessor.name);
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
  private readonly bucket = process.env.S3_EXPORTS_BUCKET ?? 'doodle-exports';

  constructor(
    @InjectRepository(ExportJobEntity)
    private readonly exportJobRepo: Repository<ExportJobEntity>,
  ) {}

  @Process('render')
  async handleExport(job: Job<ExportJobPayload>) {
    const { exportJobId, projectId, format, quality } = job.data;
    this.logger.log(`Starting export job=${exportJobId} project=${projectId} format=${format} quality=${quality}`);

    const exportJob = await this.exportJobRepo.findOneOrFail({ where: { id: exportJobId } });

    try {
      await this.updateStatus(exportJobId, 'processing', 0);
      job.progress(5);

      // 1. Fetch project data and render frames
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `export-${exportJobId}-`));
      const framesDir = path.join(tmpDir, 'frames');
      await fs.mkdir(framesDir);

      await this.updateStatus(exportJobId, 'processing', 10);
      job.progress(10);

      // 2. Render each scene to frames using Puppeteer (headless browser)
      const frameCount = await this.renderSceneFrames(projectId, framesDir, quality, (pct) => {
        const progress = 10 + pct * 0.6;
        this.updateStatus(exportJobId, 'processing', progress);
        job.progress(progress);
      });

      await this.updateStatus(exportJobId, 'processing', 70);
      job.progress(70);

      // 3. Encode with FFmpeg
      const outputFile = path.join(tmpDir, `output.${format}`);
      await this.encodeWithFFmpeg({
        framesDir,
        outputFile,
        format,
        quality,
        onProgress: (pct) => {
          const progress = 70 + pct * 0.2;
          this.updateStatus(exportJobId, 'processing', progress);
          job.progress(progress);
        },
      });

      await this.updateStatus(exportJobId, 'processing', 90);
      job.progress(90);

      // 4. Upload to S3
      const s3Key = `exports/${exportJob.userId}/${projectId}/${exportJobId}.${format}`;
      const fileBuffer = await fs.readFile(outputFile);
      const contentType = this.getContentType(format);

      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
        CacheControl: 'max-age=31536000',
      }));

      const outputUrl = `https://${process.env.CDN_DOMAIN ?? this.bucket}/${s3Key}`;

      // 5. Cleanup
      await fs.rm(tmpDir, { recursive: true, force: true });

      await this.exportJobRepo.update(exportJobId, {
        status: 'completed',
        progress: 100,
        outputUrl,
        outputSizeBytes: `${fileBuffer.byteLength}`,
        completedAt: new Date(),
      });

      this.logger.log(`Export completed job=${exportJobId} url=${outputUrl}`);
      job.progress(100);

    } catch (error: any) {
      this.logger.error(`Export failed job=${exportJobId}`, error.stack);
      await this.exportJobRepo.update(exportJobId, {
        status: 'failed',
        errorMessage: error.message,
      });
      throw error; // BullMQ will handle retry
    }
  }

  private async renderSceneFrames(
    projectId: string,
    framesDir: string,
    quality: string,
    onProgress: (pct: number) => void,
  ): Promise<number> {
    // In production: launch Puppeteer, navigate to the headless render endpoint,
    // play the video, capture frames via page.screenshot at the target FPS.
    // The render endpoint is an internal Next.js route that renders scenes headlessly.
    //
    // Example implementation sketch:
    //
    // const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    // const page = await browser.newPage();
    // const { width, height } = QUALITY_MAP[quality as keyof typeof QUALITY_MAP];
    // await page.setViewport({ width, height, deviceScaleFactor: 1 });
    // await page.goto(`${process.env.INTERNAL_APP_URL}/render/${projectId}?headless=true`);
    // ... capture frames ...
    // await browser.close();

    // Placeholder: return simulated frame count
    onProgress(1);
    return 300; // 10s at 30fps
  }

  private encodeWithFFmpeg(opts: {
    framesDir: string;
    outputFile: string;
    format: string;
    quality: string;
    onProgress: (pct: number) => void;
  }): Promise<void> {
    const { framesDir, outputFile, format, quality, onProgress } = opts;
    const { width, height, videoBitrate, audioBitrate } = QUALITY_MAP[quality as keyof typeof QUALITY_MAP];

    return new Promise((resolve, reject) => {
      const cmd = ffmpeg()
        .input(path.join(framesDir, 'frame-%05d.png'))
        .inputFPS(30)
        .videoCodec(format === 'webm' ? 'libvpx-vp9' : 'libx264')
        .outputOptions([
          `-vf scale=${width}:${height}`,
          `-b:v ${videoBitrate}`,
          `-b:a ${audioBitrate}`,
          format !== 'gif' ? '-pix_fmt yuv420p' : '',
          format === 'mp4' || format === 'mov' ? '-movflags +faststart' : '',
        ].filter(Boolean))
        .output(outputFile);

      if (format === 'gif') {
        cmd.outputOptions(['-vf', `fps=15,scale=${Math.min(width, 640)}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`]);
      }

      cmd
        .on('progress', (p) => onProgress((p.percent ?? 0) / 100))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }

  private getContentType(format: string): string {
    const map: Record<string, string> = {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
      gif: 'image/gif',
    };
    return map[format] ?? 'application/octet-stream';
  }

  private async updateStatus(id: string, status: string, progress: number) {
    await this.exportJobRepo.update(id, { status, progress });
  }
}
