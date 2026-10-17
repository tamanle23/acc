package com.unipost.service;

import com.unipost.domain.metadata.AttributeDefinition;
import com.unipost.domain.metadata.EntityRecord;
import jakarta.persistence.criteria.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.jpa.domain.Specification;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EntityRecordSpecificationsTest {

    @Mock
    private Root<EntityRecord> root;

    @Mock
    private CriteriaQuery<?> query;

    @Mock
    private CriteriaBuilder cb;

    @Mock
    private Path<Object> entityTypePath;

    @Mock
    private Path<Object> idPath;

    @Mock
    private Path<Object> deletedDatePath;

    @Mock
    private Path<Object> tenantIdPath;

    @Mock
    private Path<Object> attributesPath;

    @Mock
    private Predicate mockPredicate;

    @Mock
    private Expression<String> mockStringExpr;

    @Mock
    private Expression<Boolean> mockBoolExpr;

    @Mock
    @SuppressWarnings("rawtypes")
    private CriteriaBuilder.In mockInClause;

    @BeforeEach
    void setUp() {
        when(root.get("entityType")).thenReturn(entityTypePath);
        when(entityTypePath.get("id")).thenReturn(idPath);
        when(root.get("deletedDate")).thenReturn(deletedDatePath);
        when(root.get("tenantId")).thenReturn(tenantIdPath);
        when(root.get("attributes")).thenReturn(attributesPath);

        when(cb.equal(any(), any())).thenReturn(mockPredicate);
        when(cb.notEqual(any(), any())).thenReturn(mockPredicate);
        when(cb.isNull(any())).thenReturn(mockPredicate);
        when(cb.isTrue(any())).thenReturn(mockPredicate);
        when(cb.like(any(), anyString())).thenReturn(mockPredicate);
        when(cb.lower(any())).thenReturn(mockStringExpr);
        when(cb.function(anyString(), eq(String.class), any(), any())).thenReturn(mockStringExpr);
        when(cb.function(anyString(), eq(Boolean.class), any(), any())).thenReturn(mockBoolExpr);
        when(cb.and(any(Predicate[].class))).thenReturn(mockPredicate);
        doReturn(mockInClause).when(cb).in(any());
        when(mockStringExpr.as(Double.class)).thenReturn((Expression) mockStringExpr);
        when(cb.greaterThan(any(), any(Comparable.class))).thenReturn(mockPredicate);
        when(cb.greaterThan(any(), anyString())).thenReturn(mockPredicate);
        when(cb.greaterThanOrEqualTo(any(), any(Comparable.class))).thenReturn(mockPredicate);
        when(cb.greaterThanOrEqualTo(any(), anyString())).thenReturn(mockPredicate);
        when(cb.lessThan(any(), any(Comparable.class))).thenReturn(mockPredicate);
        when(cb.lessThan(any(), anyString())).thenReturn(mockPredicate);
        when(cb.lessThanOrEqualTo(any(), any(Comparable.class))).thenReturn(mockPredicate);
        when(cb.lessThanOrEqualTo(any(), anyString())).thenReturn(mockPredicate);
    }

    @Test
    void testWithFilters_BaseTenancyAndEntity() {
        Specification<EntityRecord> spec = EntityRecordSpecifications.withFilters(
                10L, "tenant-test", null, null
        );

        Predicate result = spec.toPredicate(root, query, cb);
        assertThat(result).isNotNull();
        verify(cb).equal(idPath, 10L);
        verify(cb).isNull(deletedDatePath);
        verify(cb).equal(tenantIdPath, "tenant-test");
    }

    @Test
    void testWithFilters_EqualityFiltersCombinedInJsonb() {
        AttributeDefinition attr1 = new AttributeDefinition();
        attr1.setSystemName("status");
        attr1.setDataType("string");

        AttributeDefinition attr2 = new AttributeDefinition();
        attr2.setSystemName("active");
        attr2.setDataType("boolean");

        AttributeDefinition attr3 = new AttributeDefinition();
        attr3.setSystemName("count");
        attr3.setDataType("integer");

        AttributeDefinition attr4 = new AttributeDefinition();
        attr4.setSystemName("price");
        attr4.setDataType("number");

        Map<String, AttributeDefinition> activeAttrs = Map.of(
                "status", attr1,
                "active", attr2,
                "count", attr3,
                "price", attr4
        );

        Map<String, Map<String, String>> filters = new HashMap<>();
        filters.put("status", Map.of("eq", "ACTIVE"));
        filters.put("active", Map.of("eq", "true"));
        filters.put("count", Map.of("eq", "42"));
        filters.put("price", Map.of("eq", "99.95"));

        Specification<EntityRecord> spec = EntityRecordSpecifications.withFilters(
                10L, "tenant-test", filters, activeAttrs
        );

        Predicate result = spec.toPredicate(root, query, cb);
        assertThat(result).isNotNull();
        verify(cb).function(eq("jsonb_contains"), eq(Boolean.class), eq(attributesPath), any());
    }

    @Test
    void testWithFilters_NonEqualityOperators() {
        AttributeDefinition nameAttr = new AttributeDefinition();
        nameAttr.setSystemName("name");
        nameAttr.setDataType("string");

        AttributeDefinition scoreAttr = new AttributeDefinition();
        scoreAttr.setSystemName("score");
        scoreAttr.setDataType("integer");

        AttributeDefinition tierAttr = new AttributeDefinition();
        tierAttr.setSystemName("tier");
        tierAttr.setDataType("string");

        Map<String, AttributeDefinition> activeAttrs = Map.of(
                "name", nameAttr,
                "score", scoreAttr,
                "tier", tierAttr
        );

        Map<String, Map<String, String>> filters = new HashMap<>();
        filters.put("name", Map.of("contains", "Acme", "ne", "Legacy"));
        filters.put("score", Map.of("gt", "100", "lte", "500"));
        filters.put("tier", Map.of("in", "GOLD, PLATINUM"));

        Specification<EntityRecord> spec = EntityRecordSpecifications.withFilters(
                10L, "tenant-test", filters, activeAttrs
        );

        Predicate result = spec.toPredicate(root, query, cb);
        assertThat(result).isNotNull();
        verify(cb).notEqual(any(), eq("Legacy"));
        verify(cb).like(any(), eq("%acme%"));
        verify(cb).in(any());
    }

    @Test
    void testWithFilters_IgnoresArchivedAndUnknownAttributes() {
        AttributeDefinition archived = new AttributeDefinition();
        archived.setSystemName("archived_field");
        archived.setIsArchived(true);

        Map<String, AttributeDefinition> activeAttrs = Map.of("archived_field", archived);
        Map<String, Map<String, String>> filters = Map.of(
                "archived_field", Map.of("eq", "test"),
                "unknown_field", Map.of("eq", "test")
        );

        Specification<EntityRecord> spec = EntityRecordSpecifications.withFilters(
                10L, "tenant-test", filters, activeAttrs
        );

        Predicate result = spec.toPredicate(root, query, cb);
        assertThat(result).isNotNull();
        // Neither archived nor unknown should generate containment
        verify(cb, never()).function(eq("jsonb_contains"), any(), any(), any());
    }

    @Test
    void testWithFilters_NumericAndStringComparators() {
        AttributeDefinition numAttr = new AttributeDefinition();
        numAttr.setSystemName("age");
        numAttr.setDataType("integer");

        AttributeDefinition strAttr = new AttributeDefinition();
        strAttr.setSystemName("code");
        strAttr.setDataType("string");

        Map<String, AttributeDefinition> activeAttrs = Map.of("age", numAttr, "code", strAttr);

        Map<String, Map<String, String>> filters = new HashMap<>();
        filters.put("age", Map.of("gt", "18", "gte", "21", "lt", "65", "lte", "70"));
        filters.put("code", Map.of("gt", "A", "gte", "B", "lt", "Y", "lte", "Z", "custom_op", "X"));

        Specification<EntityRecord> spec = EntityRecordSpecifications.withFilters(10L, null, filters, activeAttrs);
        Predicate result = spec.toPredicate(root, query, cb);
        assertThat(result).isNotNull();
    }

    @Test
    void testWithFilters_MalformedNumericFallback() {
        AttributeDefinition numAttr = new AttributeDefinition();
        numAttr.setSystemName("score");
        numAttr.setDataType("number");

        Map<String, AttributeDefinition> activeAttrs = Map.of("score", numAttr);

        Map<String, Map<String, String>> filters = new HashMap<>();
        // Non-parsable number
        filters.put("score", Map.of("gt", "not-a-number", "eq", "also-not-a-number"));

        Specification<EntityRecord> spec = EntityRecordSpecifications.withFilters(10L, "", filters, activeAttrs);
        Predicate result = spec.toPredicate(root, query, cb);
        assertThat(result).isNotNull();
    }
}
