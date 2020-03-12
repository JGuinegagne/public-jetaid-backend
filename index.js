const http = require('http');
require('dotenv').config();

const app = require('./src/App');

/** 
 * Normalizes a port into a number, string, or false.
 */
const normalizePort = (val) => {
  const parsedPort = parseInt(val, 10);
  if (isNaN(parsedPort)) {
    return val; // named pipe
  }
  if (parsedPort >= 0) {
    return parsedPort; // port number
  }

  return false;
};

const port = process.env.port || 3000;
const httpPort = normalizePort(port);
app.set('port', httpPort);


/**
* Logs when the server starts listening to the specified port
*/
const onListening = () => {
  console.log(`listening to port ${httpPort}`);
};

/** Retrieves and displays typical connection errors to the console
 * @param error to be handled
 */
const onError = (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  switch (error.code) {
  case 'EACCES':
    console.error(bind + ' requires elevated privileges');
    process.exit(1);
    break;
  case 'EADDRINUSE':
    console.error(bind + ' is already in use');
    process.exit(1);
    break;
  default:
    throw error;
  }
};

// Creates the http server
const server = http.createServer(app);

// Launches the server
server.listen(port);
server.on('listening', onListening);
server.on('error', onError);