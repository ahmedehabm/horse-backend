-- DropForeignKey
ALTER TABLE `horse` DROP FOREIGN KEY `Horse_cameraId_fkey`;

-- DropForeignKey
ALTER TABLE `horse` DROP FOREIGN KEY `Horse_feederId_fkey`;

-- AlterTable
ALTER TABLE `horse` MODIFY `feederId` VARCHAR(191) NULL,
    MODIFY `cameraId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Horse` ADD CONSTRAINT `Horse_feederId_fkey` FOREIGN KEY (`feederId`) REFERENCES `Device`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Horse` ADD CONSTRAINT `Horse_cameraId_fkey` FOREIGN KEY (`cameraId`) REFERENCES `Device`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
