import * as redis from "redis";

const rClient = redis.createClient();

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
