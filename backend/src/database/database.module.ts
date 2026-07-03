import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

/**
 * Global MongoDB connection via Mongoose.
 *
 * Feature modules import `MongooseModule.forFeature([...])` to register their
 * own schemas; this module owns only the shared connection lifecycle.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const db = config.get('database') as {
          uri: string;
          dbName: string;
        };
        return {
          uri: db.uri,
          dbName: db.dbName,
          onConnectionCreate: (connection) => {
            connection.on('connected', () => logger.log('MongoDB connected'));
            connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
            connection.on('error', (err: Error) =>
              logger.error(`MongoDB error: ${err.message}`),
            );
            return connection;
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
