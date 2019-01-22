const keys = require('./keys');
const redis = require('redis');

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  // connect 1x every 1000ms
  retry_strategy: () => 1000
});

// A subscription. Used for calculating 
// the fib() value when a new number is 
// inserted in the redis db.
const sub = redisClient.duplicate();

// A classic Fibonacci calculator
function fib(index) {
  if (index < 2) return 1;
  return fib(index - 1) + fib(index - 2);
}

// Handler for new messages
sub.on('message', (channel, message) => {
  // Sets a value into the 'values' Hash
  // the key is the received message, i.e. the number entered into the
  // react app, and the value is the Fibonacci value for that number.
  redisClient.hset('values', message, fib(parseInt(message)));
});
// Subscribe to insert messages.
sub.subscribe('insert');