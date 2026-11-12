package com.acc.sandbox.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.domain.metadata.EntityType;
import com.acc.domain.metadata.RelationshipType;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.repository.jpa.RelationshipTypeRepository;
import com.acc.sandbox.config.SandboxProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.*;

import static org.mockito.Mockito.*;

class CmsDataScaffoldingGeneratorTest {

    @Test
    @DisplayName("Should skip scaffolding when seed is disabled")
    void testSkipWhenDisabled() {
        SandboxProperties props = new SandboxProperties();
        props.getSeed().setEnabled(false);

        @SuppressWarnings("unchecked")
        ObjectProvider<JdbcTemplate> jdbcProvider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<EntityTypeRepository> entityTypeRepoProvider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<RelationshipTypeRepository> relTypeRepoProvider = mock(ObjectProvider.class);

        CmsDataScaffoldingGenerator generator = new CmsDataScaffoldingGenerator(
                props, jdbcProvider, entityTypeRepoProvider, relTypeRepoProvider, new ObjectMapper()
        );

        generator.scaffoldCmsDataIfMissing();

        verifyNoInteractions(jdbcProvider);
    }

    @Test
    @DisplayName("Should scaffold CMS categories, media assets, articles, and relationships via batch inserts")
    void testScaffoldCmsData() {
        SandboxProperties props = new SandboxProperties();
        props.getSeed().setEnabled(true);
        props.getSeed().setArticlesCount(100);
        props.getSeed().setCategoriesCount(10);
        props.getSeed().setMediaAssetsCount(20);
        props.getSeed().setTenantId("tenant-acme");

        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        EntityTypeRepository entityTypeRepo = mock(EntityTypeRepository.class);
        RelationshipTypeRepository relTypeRepo = mock(RelationshipTypeRepository.class);

        @SuppressWarnings("unchecked")
        ObjectProvider<JdbcTemplate> jdbcProvider = mock(ObjectProvider.class);
        when(jdbcProvider.getIfAvailable()).thenReturn(jdbcTemplate);

        @SuppressWarnings("unchecked")
        ObjectProvider<EntityTypeRepository> entityTypeRepoProvider = mock(ObjectProvider.class);
        when(entityTypeRepoProvider.getIfAvailable()).thenReturn(entityTypeRepo);

        @SuppressWarnings("unchecked")
        ObjectProvider<RelationshipTypeRepository> relTypeRepoProvider = mock(ObjectProvider.class);
        when(relTypeRepoProvider.getIfAvailable()).thenReturn(relTypeRepo);

        // Mock entity types
        EntityType articleType = new EntityType();
        articleType.setId(101L);
        articleType.setSystemName("ent_cms_article");

        EntityType categoryType = new EntityType();
        categoryType.setId(102L);
        categoryType.setSystemName("ent_cms_category");

        EntityType mediaType = new EntityType();
        mediaType.setId(103L);
        mediaType.setSystemName("ent_cms_media_asset");

        when(entityTypeRepo.findByTenantIdAndSystemNameAndDeletedDateIsNull("tenant-acme", "ent_cms_article"))
                .thenReturn(Optional.of(articleType));
        when(entityTypeRepo.findByTenantIdAndSystemNameAndDeletedDateIsNull("tenant-acme", "ent_cms_category"))
                .thenReturn(Optional.of(categoryType));
        when(entityTypeRepo.findByTenantIdAndSystemNameAndDeletedDateIsNull("tenant-acme", "ent_cms_media_asset"))
                .thenReturn(Optional.of(mediaType));

        // Mock query for existing count (0 so it proceeds with scaffolding)
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), eq(101L), eq("tenant-acme")))
                .thenReturn(0);

        // Mock query for fetching IDs by UIDs
        when(jdbcTemplate.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), any(Object[].class)))
                .thenAnswer(invocation -> {
                    Object lastArg = invocation.getArgument(2);
                    int count = 10;
                    if (lastArg instanceof Object[] arr) {
                        count = arr.length;
                    }
                    List<Long> mockIds = new ArrayList<>();
                    for (int i = 1; i <= count; i++) {
                        mockIds.add((long) (i + 1000));
                    }
                    return mockIds;
                });

        // Mock relationship types
        RelationshipType relCategory = new RelationshipType();
        relCategory.setId(201L);
        relCategory.setSystemName("rel_article_primary_category");

        RelationshipType relMedia = new RelationshipType();
        relMedia.setId(202L);
        relMedia.setSystemName("rel_article_cover_media");

        when(relTypeRepo.findByTenantIdAndDeletedDateIsNull("tenant-acme"))
                .thenReturn(List.of(relCategory, relMedia));

        CmsDataScaffoldingGenerator generator = new CmsDataScaffoldingGenerator(
                props, jdbcProvider, entityTypeRepoProvider, relTypeRepoProvider, new ObjectMapper()
        );

        generator.scaffoldCmsDataIfMissing();

        // Verify SET LOCAL tenant session
        verify(jdbcTemplate, atLeastOnce()).execute(contains("SET LOCAL app.current_tenant_id = 'tenant-acme'"));

        // Verify batch updates were performed for entities and relationships
        verify(jdbcTemplate, atLeast(4)).batchUpdate(anyString(), anyList());
    }
}
