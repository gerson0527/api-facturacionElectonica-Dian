import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Debug: log the exception
    this.logger.warn(`Exception caught: ${exception?.constructor?.name} | ${(exception as any)?.message} | status: ${(exception as any)?.getStatus?.()}`);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Error interno del servidor";
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      if (typeof exResponse === "string") {
        message = exResponse;
      } else if (typeof exResponse === "object") {
        const obj = exResponse as Record<string, any>;
        message = obj.message || obj.error || message;
        details = obj.errors || obj.details;
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled: ${exception.message}`, exception.stack);
    }

    const requestId = (request as any).requestId || "unknown";

    response.status(status).json({
      code: status,
      message,
      details: details || request.url,
      requestId,
    });
  }
}
