import 'dotenv/config';
import app from './app';
import { logger } from './utils/logger';
import { prisma } from './prisma/client';

const PORT = parseInt(process.env.PORT || '4000', 10);

async function main() {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');

    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 CloudGST Pro API running on port ${PORT} (0.0.0.0)`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
