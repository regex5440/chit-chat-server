const redis = require("redis");

const rClient = redis.createClient();

rClient.connect();

async function getRData(key) {
  return rClient.get(key);
}

async function setRData(key, value) {
  return rClient.set(key, value, {
    EX: 60 * 60 * 24 * 30, // 30 days = seconds x minutes x hours x 30
  });
}

async function removeRData(key) {
  return rClient.del(key);
}
module.exports = { getRData, setRData, removeRData };
