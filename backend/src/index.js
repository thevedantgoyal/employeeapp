import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const prefix = config.apiPrefix || '/api';
app.use(prefix, routes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT);
server.once('listening', () => {
  console.log(`ConnectPlus API listening on port ${config.port} at ${prefix}`);
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the other process (e.g. kill $(lsof -ti :${PORT})) or set PORT in backend/.env.`,
    );
    process.exit(1);
  }
  throw err;
});

export default server;
