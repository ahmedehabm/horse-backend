-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `passwordChangedAt` DATETIME(3) NULL,
    `passwordResetToken` VARCHAR(191) NULL,
    `passwordResetExpires` DATETIME(3) NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_passwordResetToken_key`(`passwordResetToken`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_passwordResetToken_idx`(`passwordResetToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Horse` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `image` VARCHAR(191) NULL,
    `breed` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `feederId` VARCHAR(191) NULL,
    `defaultAmountKg` DOUBLE NULL,
    `lastFeedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Horse_ownerId_idx`(`ownerId`),
    INDEX `Horse_feederId_idx`(`feederId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feeder` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NULL,
    `feederType` ENUM('MANUAL', 'SCHEDULED') NOT NULL DEFAULT 'MANUAL',
    `morningTime` VARCHAR(191) NULL,
    `dayTime` VARCHAR(191) NULL,
    `nightTime` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NOT NULL,
    `streamToken` VARCHAR(191) NULL,
    `streamTokenIsValid` BOOLEAN NOT NULL,
    `cameraUrl` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Feeder_serialNumber_key`(`serialNumber`),
    UNIQUE INDEX `Feeder_streamToken_key`(`streamToken`),
    INDEX `Feeder_serialNumber_idx`(`serialNumber`),
    INDEX `Feeder_streamToken_idx`(`streamToken`),
    INDEX `Feeder_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feeding` (
    `id` VARCHAR(191) NOT NULL,
    `horseId` VARCHAR(191) NOT NULL,
    `feederId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `requestedKg` DOUBLE NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `isScheduled` BOOLEAN NOT NULL DEFAULT false,
    `timeSlot` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Feeding_horseId_idx`(`horseId`),
    INDEX `Feeding_feederId_idx`(`feederId`),
    INDEX `Feeding_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Horse` ADD CONSTRAINT `Horse_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Horse` ADD CONSTRAINT `Horse_feederId_fkey` FOREIGN KEY (`feederId`) REFERENCES `Feeder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feeder` ADD CONSTRAINT `Feeder_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feeding` ADD CONSTRAINT `Feeding_horseId_fkey` FOREIGN KEY (`horseId`) REFERENCES `Horse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feeding` ADD CONSTRAINT `Feeding_feederId_fkey` FOREIGN KEY (`feederId`) REFERENCES `Feeder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
