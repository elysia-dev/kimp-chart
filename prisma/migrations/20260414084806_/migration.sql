-- CreateTable
CREATE TABLE "kimp_candle_1m" (
    "time" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(10,4) NOT NULL,
    "high" DECIMAL(10,4) NOT NULL,
    "low" DECIMAL(10,4) NOT NULL,
    "close" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kimp_candle_1m_pkey" PRIMARY KEY ("time")
);

-- CreateIndex
CREATE INDEX "kimp_candle_1m_time_idx" ON "kimp_candle_1m"("time");
