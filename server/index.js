const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});
pgClient.on('error', () => console.log('Lost PG connection'));

// Create the database to house all the values (indices) that our
// application has calculated for.
pgClient
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch((err) => console.log(err));

// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  // Retry connection every 1000ms
  retry_strategy: () => 1000
});
const redisPublisher = redisClient.duplicate();

// Express route handlers
app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');
  // only send back the actual row data, not any other metadata
  // which typically gets returned by a call to the .query method.
  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  })
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  // cap the max value that can be requested
  // otherwise the app's fibonacci implementation make take
  // too long.
  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  // publish this index to the query to be processed
  redisPublisher.publish('insert', index);
  // store the requested index in PG
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
  res.send({ working: true });
});

app.listen(5000, err => {
  console.log('Listening');
});