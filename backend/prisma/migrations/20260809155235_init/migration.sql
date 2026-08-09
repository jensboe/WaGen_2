-- CreateTable
CREATE TABLE "Image" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "originalPath" TEXT NOT NULL,
    "finalPath" TEXT,
    "cropX" REAL,
    "cropY" REAL,
    "cropWidth" REAL,
    "cropHeight" REAL,
    "aspectRatio" TEXT,
    "watermarkId" INTEGER,
    "watermarkPosition" TEXT,
    "watermarkProportion" INTEGER,
    "watermarkBorder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Image_watermarkId_fkey" FOREIGN KEY ("watermarkId") REFERENCES "Watermark" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Watermark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ImageRedaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "imageId" INTEGER NOT NULL,
    "tool" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "x" REAL,
    "y" REAL,
    "width" REAL,
    "height" REAL,
    "rotation" REAL,
    "brushSize" REAL,
    "blur" INTEGER NOT NULL,
    CONSTRAINT "ImageRedaction_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageRedactionPoint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "redactionId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    CONSTRAINT "ImageRedactionPoint_redactionId_fkey" FOREIGN KEY ("redactionId") REFERENCES "ImageRedaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
