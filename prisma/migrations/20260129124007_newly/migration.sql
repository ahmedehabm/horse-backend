/*
  Warnings:

  - You are about to drop the column `feederId` on the `feeding` table. All the data in the column will be lost.
  - You are about to drop the `feeder` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[cameraId]` on the table `Horse` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `deviceId` to the `Feeding` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cameraId` to the `Horse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `location` to the `Horse` table without a default value. This is not possible if the table is not empty.
  - Made the column `feederId` on table `horse` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `feeding` DROP FOREIGN KEY `Feeding_feederId_fkey`;

-- DropForeignKey
ALTER TABLE `horse` DROP FOREIGN KEY `Horse_feederId_fkey`;

-- DropIndex
DROP INDEX `Feeding_feederId_idx` ON `feeding`;

-- AlterTable
ALTER TABLE `feeding` DROP COLUMN `feederId`,
    ADD COLUMN `deviceId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `horse` ADD COLUMN `cameraId` VARCHAR(191) NOT NULL,
    ADD COLUMN `location` VARCHAR(191) NOT NULL,
    MODIFY `feederId` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `feeder`;

-- CreateTable
CREATE TABLE `Device` (
    `id` VARCHAR(191) NOT NULL,
    `deviceType` ENUM('CAMERA', 'FEEDER') NOT NULL,
    `thingName` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `feederType` ENUM('MANUAL', 'SCHEDULED') NOT NULL DEFAULT 'MANUAL',
    `morningTime` VARCHAR(191) NULL,
    `dayTime` VARCHAR(191) NULL,
    `nightTime` VARCHAR(191) NULL,
    `streamToken` VARCHAR(191) NULL,
    `streamTokenIsValid` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Device_thingName_key`(`thingName`),
    UNIQUE INDEX `Device_streamToken_key`(`streamToken`),
    INDEX `Device_thingName_idx`(`thingName`),
    INDEX `Device_deviceType_idx`(`deviceType`),
    INDEX `Device_streamToken_idx`(`streamToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Feeding_deviceId_idx` ON `Feeding`(`deviceId`);

-- CreateIndex
CREATE UNIQUE INDEX `Horse_cameraId_key` ON `Horse`(`cameraId`);

-- CreateIndex
CREATE INDEX `Horse_cameraId_idx` ON `Horse`(`cameraId`);

-- AddForeignKey
ALTER TABLE `Horse` ADD CONSTRAINT `Horse_feederId_fkey` FOREIGN KEY (`feederId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Horse` ADD CONSTRAINT `Horse_cameraId_fkey` FOREIGN KEY (`cameraId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feeding` ADD CONSTRAINT `Feeding_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
