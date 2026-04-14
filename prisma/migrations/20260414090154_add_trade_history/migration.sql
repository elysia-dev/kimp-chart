-- DropIndex
DROP INDEX "kimp_candle_1m_time_idx";

-- CreateTable
CREATE TABLE "kimp_candle_1h" (
    "time" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(10,4) NOT NULL,
    "high" DECIMAL(10,4) NOT NULL,
    "low" DECIMAL(10,4) NOT NULL,
    "close" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kimp_candle_1h_pkey" PRIMARY KEY ("time")
);

-- CreateTable
CREATE TABLE "kimp_candle_1d" (
    "time" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(10,4) NOT NULL,
    "high" DECIMAL(10,4) NOT NULL,
    "low" DECIMAL(10,4) NOT NULL,
    "close" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kimp_candle_1d_pkey" PRIMARY KEY ("time")
);
