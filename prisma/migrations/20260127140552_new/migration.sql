/*
  Warnings:

  - A unique constraint covering the columns `[feederId]` on the table `Horse` will be added. If there are existing duplicate values, this will fail.
  - Made the column `location` on table `feeder` required. This step will fail if there are existing NULL values in that column.
  - Made the column `breed` on table `horse` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `feeder` MODIFY `location` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `horse` MODIFY `breed` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Horse_feederId_key` ON `Horse`(`feederId`);
