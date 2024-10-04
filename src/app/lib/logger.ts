// src/app/lib/logger.ts

'use client'

import { BrowserLogger, LogEntry, LoggerListener } from '@/app/types';

class BrowserLoggerImpl implements BrowserLogger {
  logBuffer: string[] = [];
  MAX_LOG_ENTRIES: number = 1000;
  listeners: Map<string, Set<LoggerListener>> = new Map();

  log(level: string, msg: string, meta?: unknown): void {
    const logEntry: LogEntry = { level, msg, meta, timestamp: new Date().toISOString() };
    this.logBuffer.push(this.safeStringify(logEntry));
    if (this.logBuffer.length > this.MAX_LOG_ENTRIES) {
      this.logBuffer.shift();
    }
    this.emit('newLog', this.safeStringify(logEntry));

    switch (level) {
      case 'error':
        console.error(msg, meta);
        break;
      case 'warn':
        console.warn(msg, meta);
        break;
      case 'info':
        console.info(msg, meta);
        break;
      default:
        console.log(msg, meta);
    }
  }

  error(msg: string, meta?: unknown): void {
    this.log('error', msg, meta);
  }

  warn(msg: string, meta?: unknown): void {
    this.log('warn', msg, meta);
  }

  info(msg: string, meta?: unknown): void {
    this.log('info', msg, meta);
  }

  debug(msg: string, meta?: unknown): void {
    this.log('debug', msg, meta);
  }

  on(eventName: string, listener: LoggerListener): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(listener);
  }

  off(eventName: string, listener: LoggerListener): void {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName)!.delete(listener);
    }
  }

  emit(eventName: string, data: string): void {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName)!.forEach((listener) => {
        listener(data);
      });
    }
  }

  safeStringify(obj: unknown): string {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }
}

const browserLogger = new BrowserLoggerImpl();
export default browserLogger;