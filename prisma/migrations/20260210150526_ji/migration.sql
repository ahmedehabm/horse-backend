/*
  Warnings:

  - A unique constraint covering the columns `[thingLabel]` on the table `Device` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `thingLabel` to the `Device` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `device` ADD COLUMN `thingLabel` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Device_thingLabel_key` ON `Device`(`thingLabel`);
