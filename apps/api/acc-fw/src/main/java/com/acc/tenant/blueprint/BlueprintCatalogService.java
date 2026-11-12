package com.acc.tenant.blueprint;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BlueprintCatalogService {

    private final ObjectMapper objectMapper;
    private final Map<String, BlueprintManifest> blueprintCatalog = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadBlueprints() {
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath:metadata/blueprints/*.json");
            log.info("Discovered {} blueprint manifest resources", resources.length);

            for (Resource resource : resources) {
                try (InputStream is = resource.getInputStream()) {
                    BlueprintManifest manifest = objectMapper.readValue(is, BlueprintManifest.class);
                    if (manifest != null && manifest.id() != null) {
                        blueprintCatalog.put(manifest.id(), manifest);
                        log.info("Loaded blueprint template: '{}' (id: {}) with {} entity types", 
                                manifest.name(), manifest.id(), 
                                manifest.entityTypes() != null ? manifest.entityTypes().size() : 0);
                    }
                } catch (Exception e) {
                    log.error("Failed to parse blueprint JSON at {}: {}", resource.getFilename(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Failed to scan classpath for blueprints: {}", e.getMessage(), e);
        }
    }

    public List<BlueprintSummaryDto> getAvailableBlueprints() {
        return blueprintCatalog.values().stream()
                .map(BlueprintSummaryDto::from)
                .sorted(Comparator.comparing(BlueprintSummaryDto::name))
                .collect(Collectors.toList());
    }

    public Optional<BlueprintManifest> getBlueprint(String blueprintId) {
        if (blueprintId == null || blueprintId.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(blueprintCatalog.get(blueprintId));
    }
}
