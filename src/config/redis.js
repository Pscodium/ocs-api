const { createClient } = require("redis");
const logger = require('../services/logs.service');

const redis = createClient({
  url: process.env.REDIS_URL
});

redis.on("error", err => {
  console.log(logger.alert("❌ Redis error:", err));
});

async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect()
    console.log(logger.success("✅ Redis conectado"))
  }
}

connectRedis();

module.exports = redis;