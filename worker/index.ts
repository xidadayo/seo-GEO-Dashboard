import { Worker } from "bullmq";
const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
};
const worker = new Worker("seo-geo-jobs", async (job) => {
  console.log(`[worker] ${job.name}`, job.data);
  return { ok: true, completedAt: new Date().toISOString() };
}, { connection });
worker.on("failed", (job, error) => console.error(`[worker] ${job?.name} failed`, error));
