package com.unipost.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;

/**
 * Ensures upcoming monthly partitions for UNIPOST_RECORD_AUDIT_LOG exist ahead of time.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditPartitionProvisioner {

    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void init() {
        try {
            ensurePartitionsForNextMonths(3);
        } catch (Exception e) {
            log.warn("Could not auto-provision audit log partitions at startup (possibly non-Postgres or restricted DDL): {}", e.getMessage());
        }
    }

    /**
     * Daily check to maintain rolling monthly partitions.
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void scheduledPartitionCheck() {
        try {
            ensurePartitionsForNextMonths(3);
        } catch (Exception e) {
            log.error("Failed to provision rolling audit log partitions during scheduled check: {}", e.getMessage());
        }
    }

    /**
     * Creates partitions for the current month and upcoming N months if they do not already exist.
     *
     * @param monthsAhead number of months ahead to ensure partitions exist for
     */
    public void ensurePartitionsForNextMonths(int monthsAhead) {
        YearMonth current = YearMonth.now();
        for (int i = 0; i <= monthsAhead; i++) {
            YearMonth target = current.plusMonths(i);
            provisionMonthlyPartition(target);
        }
    }

    private void provisionMonthlyPartition(YearMonth ym) {
        String partitionName = String.format("unipost_record_audit_log_%d_%02d", ym.getYear(), ym.getMonthValue());
        LocalDate startDate = ym.atDay(1);
        LocalDate endDate = ym.plusMonths(1).atDay(1);

        DateTimeFormatter dtf = DateTimeFormatter.ISO_LOCAL_DATE;
        String startStr = startDate.format(dtf) + " 00:00:00+00";
        String endStr = endDate.format(dtf) + " 00:00:00+00";

        String ddl = String.format(
                "CREATE TABLE IF NOT EXISTS %s PARTITION OF UNIPOST_RECORD_AUDIT_LOG " +
                        "FOR VALUES FROM ('%s') TO ('%s');",
                partitionName, startStr, endStr
        );

        try {
            jdbcTemplate.execute(ddl);
            log.debug("Verified audit log partition: {}", partitionName);
        } catch (Exception e) {
            log.debug("Partition creation query skipped for {}: {}", partitionName, e.getMessage());
        }
    }
}
