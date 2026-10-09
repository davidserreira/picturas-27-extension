// Video messages need publisher confirmation and an ack after MongoDB writes.
// Other image tools keep their existing broker implementation.
const amqp = require("amqplib");
const EXCHANGE = "picturas";

function connect() {
  return amqp.connect({
    hostname: process.env.RABBITMQ_HOST || "rabbitmq",
    port: Number(process.env.RABBITMQ_PORT || 5672),
    username: process.env.RABBITMQ_USER || "user",
    password: process.env.RABBITMQ_PASS || "password",
    heartbeat: 30,
  }, { timeout: 1500 });
}

async function publish(queue, message) {
  const connection = await connect();
  connection.on("error", (err) => console.error("[video-broker]", err.message));
  try {
    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(EXCHANGE, "direct", { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, EXCHANGE, queue);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Publisher confirmation timed out")), 1500);
      channel.publish(EXCHANGE, queue, Buffer.from(JSON.stringify(message)),
        { persistent: true, contentType: "application/json" }, (err) => {
          clearTimeout(timer);
          if (err) reject(err); else resolve();
        });
    });
  } finally {
    await connection.close().catch(() => {});
  }
}

function consume(queue, handler) {
  async function start() {
    let connection;
    let retryScheduled = false;
    function retry() {
      if (retryScheduled) return;
      retryScheduled = true;
      setTimeout(start, 5000);
    }
    try {
      connection = await connect();
      connection.on("error", (err) => console.error("[video-broker]", err.message));
      connection.once("close", retry);
      const channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE, "direct", { durable: true });
      await channel.assertQueue(queue, { durable: true });
      await channel.bindQueue(queue, EXCHANGE, queue);
      await channel.prefetch(1);
      await channel.consume(queue, async (message) => {
        if (!message) return;
        try {
          await handler(message);
          channel.ack(message);
        } catch (err) {
          console.error("[video-broker] reply will be retried:", err.message);
          // Closing the channel returns unacknowledged replies to the queue.
          await connection.close().catch(() => {});
        }
      });
    } catch (err) {
      console.error("[video-broker] could not consume:", err.message);
      if (connection) await connection.close().catch(() => {});
      retry();
    }
  }
  void start();
}

module.exports = { publish, consume };
