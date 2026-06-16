import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (!AUDITED_METHODS.has(req.method)) return next.handle();

    const user = req.user;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            JSON.stringify({
              type: 'audit',
              userId: user?.id ?? 'anonymous',
              method: req.method,
              path: req.url,
              statusCode: context.switchToHttp().getResponse().statusCode,
              durationMs: Date.now() - start,
              ip: req.ip,
              userAgent: req.headers['user-agent'],
            })
          );
        },
        error: (err) => {
          this.logger.warn(
            JSON.stringify({
              type: 'audit_error',
              userId: user?.id ?? 'anonymous',
              method: req.method,
              path: req.url,
              error: err.message,
              durationMs: Date.now() - start,
            })
          );
        },
      })
    );
  }
}
