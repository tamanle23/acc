package com.acc.repository.jpa;

import com.acc.domain.outbox.OutboxEvent;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OutboxEventRepository extends BaseRepository<OutboxEvent> {

    Optional<OutboxEvent> findByEventId(String eventId);

    List<OutboxEvent> findByStatusAndDeletedDateIsNull(String status);

    /**
     * Finds pending outbox events up to limit with pessimistic lock (SKIP LOCKED in PostgreSQL).
     */
    @Query(value = "SELECT * FROM UNIPOST_EVENT_OUTBOX " +
            "WHERE status = 'PENDING' AND \"deletedDate\" IS NULL " +
            "ORDER BY \"createdDate\" ASC " +
            "LIMIT :limit FOR UPDATE SKIP LOCKED", nativeQuery = true)
    List<OutboxEvent> findPendingEventsForProcessing(@Param("limit") int limit);
}
