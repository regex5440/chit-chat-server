import * as redis from "redis";
import { config } from "dotenv";
config();

const rClient = redis.createClient(
  process.env.NODE_ENV === "production"
    ? {
        password: process.env.Redis_Password,
        socket: {
          host: "redis-11729.c302.asia-northeast1-1.gce.cloud.redislabs.com",
          port: 11729,
        },
      }
    : {},
);

rClient.connect();

async function getRData(key: string) {
  return rClient.get(key);
}

async function setRData(key: string, value: string) {
  return rClient.set(key, value, {
    EX: 60 * 60 * 24 * 30, // 30 days = seconds x minutes x hours x 30
  });
}

async function removeRData(key: string) {
  return rClient.del(key);
}
export { getRData, setRData, removeRData };
