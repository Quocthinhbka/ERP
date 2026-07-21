import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';
import { OrganizationModule } from './organization/organization.module';
import { PermissionGroupsModule } from './permission-groups/permission-groups.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '../../../.env'),
        join(__dirname, '../../../.env.local'),
      ],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    HealthModule,
    QueueModule,
    OrganizationModule,
    PermissionGroupsModule,
  ],
})
export class AppModule {}
