import type { RedisLikeClient } from "@/lib/rate-limit/redis-store";

interface UpstashResponse<T> {
  result: T;
  error?: string;
}

export class UpstashRedisRestClient implements RedisLikeClient {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async command<T>(command: string[]): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as UpstashResponse<T> | null;
    if (!response.ok || !payload || payload.error) {
      throw new Error(payload?.error ?? `Upstash request failed with status ${response.status}.`);
    }
    return payload.result;
  }

  incr(key: string): Promise<number> {
    return this.command<number>(["INCR", key]);
  }

  decr(key: string): Promise<number> {
    return this.command<number>(["DECR", key]);
  }

  pttl(key: string): Promise<number> {
    return this.command<number>(["PTTL", key]);
  }

  pexpire(key: string, milliseconds: number): Promise<number> {
    return this.command<number>(["PEXPIRE", key, String(milliseconds)]);
  }

  del(key: string): Promise<number> {
    return this.command<number>(["DEL", key]);
  }
}