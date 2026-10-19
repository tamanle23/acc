package com.unipost.service;

import com.unipost.domain.metadata.*;
import com.unipost.presentation.dto.metadata.ChildPaginationParam;
import com.unipost.presentation.dto.metadata.CompositeRecordResponse;
import com.unipost.repository.jpa.EntityRecordRepository;
import com.unipost.repository.jpa.EntityRelationshipRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataLoaderBatchResolverTest {

    @Mock
    private EntityRecordRepository entityRecordRepository;

    @Mock
    private EntityRelationshipRepository entityRelationshipRepository;

    private DataLoaderBatchResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new DataLoaderBatchResolver(entityRecordRepository, entityRelationshipRepository);
    }

    @Test
    void testResolveBatch_NullOrEmptyInputs_ReturnsEmpty() {
        assertThat(resolver.resolveBatch(null, List.of(new EntityRecord()), Map.of())).isEmpty();
        assertThat(resolver.resolveBatch(new CompositeSpec(1L, "root", "root", List.of(), List.of()), null, Map.of())).isEmpty();
        assertThat(resolver.resolveBatch(new CompositeSpec(1L, "root", "root", List.of(), List.of()), Collections.emptyList(), Map.of())).isEmpty();
    }

    @Test
    void testResolveBatch_PatternB_ForeignKey_OneToMany() {
        CompositeSpec spec = new CompositeSpec(
                10L,
                "customer",
                "customer",
                List.of(new CompositeField("company_name", "companyName", "STRING", null, true)),
                List.of(new CompositeNode(
                        20L,
                        "order",
                        "orders",
                        CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                        "customer_id",
                        null,
                        "ONE_TO_MANY",
                        List.of(new CompositeField("order_no", "orderNo", "STRING", null, true)),
                        null
                ))
        );

        EntityRecord root = new EntityRecord();
        root.setId(100L);
        root.setTenantId("tenant-corp");
        root.setAttributes(Map.of("company_name", "Acme Corporation"));

        EntityRecord childOrder1 = new EntityRecord();
        childOrder1.setId(501L);
        childOrder1.setTenantId("tenant-corp");
        childOrder1.setAttributes(Map.of("customer_id", 100L, "order_no", "ORD-1"));

        EntityRecord childOrder2 = new EntityRecord();
        childOrder2.setId(502L);
        childOrder2.setTenantId("tenant-corp");
        childOrder2.setAttributes(Map.of("customer_id", 100L, "order_no", "ORD-2"));

        when(entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(20L))
                .thenReturn(List.of(childOrder1, childOrder2));

        Map<String, ChildPaginationParam> params = Map.of("orders", new ChildPaginationParam(1, 0));
        List<CompositeRecordResponse> responses = resolver.resolveBatch(spec, List.of(root), params);

        assertThat(responses).hasSize(1);
        CompositeRecordResponse res = responses.get(0);
        assertThat(res.id()).isEqualTo(100L);
        assertThat(res.attributes().get("companyName")).isEqualTo("Acme Corporation");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> orders = (List<Map<String, Object>>) res.attributes().get("orders");
        assertThat(orders).hasSize(1); // Sliced by limit=1
        assertThat(orders.get(0).get("orderNo")).isEqualTo("ORD-1");
        assertThat(res.childPagination().get("orders").totalElements()).isEqualTo(2);
        assertThat(res.childPagination().get("orders").hasMore()).isTrue();
    }

    @Test
    void testResolveBatch_PatternB_ForeignKey_OneToOne() {
        CompositeSpec spec = new CompositeSpec(
                10L,
                "customer",
                "customer",
                List.of(new CompositeField("name", "name", "STRING", null, true)),
                List.of(new CompositeNode(
                        30L,
                        "profile",
                        "profile",
                        CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                        "customer_id",
                        null,
                        "ONE_TO_ONE",
                        List.of(new CompositeField("bio", "bio", "STRING", null, true)),
                        null
                ))
        );

        EntityRecord root = new EntityRecord();
        root.setId(100L);
        root.setTenantId("tenant-corp");
        root.setAttributes(Map.of("name", "John"));

        EntityRecord profile = new EntityRecord();
        profile.setId(601L);
        profile.setTenantId("tenant-corp");
        profile.setAttributes(Map.of("customer_id", 100L, "bio", "Software Architect"));

        when(entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(30L))
                .thenReturn(List.of(profile));

        List<CompositeRecordResponse> responses = resolver.resolveBatch(spec, List.of(root), Map.of());

        assertThat(responses).hasSize(1);
        @SuppressWarnings("unchecked")
        Map<String, Object> prof = (Map<String, Object>) responses.get(0).attributes().get("profile");
        assertThat(prof).isNotNull();
        assertThat(prof.get("bio")).isEqualTo("Software Architect");
    }

    @Test
    void testResolveBatch_PatternC_Relationships() {
        CompositeSpec spec = new CompositeSpec(
                10L,
                "article",
                "article",
                List.of(),
                List.of(new CompositeNode(
                        40L,
                        "tag",
                        "tags",
                        CompositeJoinPattern.PATTERN_C_ASSOCIATION,
                        null,
                        55L,
                        "ONE_TO_MANY",
                        null,
                        null
                ))
        );

        EntityRecord root = new EntityRecord();
        root.setId(200L);
        root.setTenantId("tenant-corp");
        root.setAttributes(Map.of("title", "Post 1"));

        RelationshipType relType = new RelationshipType();
        relType.setId(55L);

        EntityRecord tagRecord = new EntityRecord();
        tagRecord.setId(701L);
        tagRecord.setTenantId("tenant-corp");
        tagRecord.setAttributes(Map.of("tag_name", "Java"));

        EntityRelationship edge = new EntityRelationship();
        edge.setId(1L);
        edge.setRelationshipType(relType);
        edge.setSourceEntity(root);
        edge.setTargetEntity(tagRecord);

        Page<EntityRelationship> page = new PageImpl<>(List.of(edge));
        when(entityRelationshipRepository.findBySourceEntityIdAndDeletedDateIsNull(eq(200L), any(Pageable.class)))
                .thenReturn(page);

        List<CompositeRecordResponse> responses = resolver.resolveBatch(spec, List.of(root), Map.of());

        assertThat(responses).hasSize(1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tags = (List<Map<String, Object>>) responses.get(0).attributes().get("tags");
        assertThat(tags).hasSize(1);
        assertThat(tags.get(0).get("tag_name")).isEqualTo("Java");
    }
}
