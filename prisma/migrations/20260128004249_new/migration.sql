/*
  Warnings:

  - You are about to drop the column `cameraUrl` on the `feeder` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `feeder` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `feeder` DROP FOREIGN KEY `Feeder_ownerId_fkey`;

-- DropIndex
DROP INDEX `Feeder_ownerId_idx` ON `feeder`;

-- AlterTable
ALTER TABLE `feeder` DROP COLUMN `cameraUrl`,
    DROP COLUMN `ownerId`;
