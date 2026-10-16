package com.unipost.presentation;

import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.Page;
import com.unipost.core.io.PageRequest;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.presentation.dto.metadata.ChildPaginationParam;
import com.unipost.presentation.dto.metadata.CompositeRecordResponse;
import com.unipost.service.CompositeRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/v1/metadata/composite-entities")
@RequiredArgsConstructor
public class CompositeEntityController {

    private final CompositeRecordService compositeRecordService;
    private final ResponseEntityBuilder responseBuilder;

    private static final Pattern CHILD_LIMIT_PATTERN = Pattern.compile("^childLimit\\[([^\\]]+)\\]$");
    private static final Pattern CHILD_OFFSET_PATTERN = Pattern.compile("^childOffset\\[([^\\]]+)\\]$");

    @GetMapping("/{id}/records")
    @PreAuthorize("hasAuthority('METADATA_RECORD_READ') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Page<CompositeRecordResponse>>> getCompositeRecords(
            @PathVariable("id") Long id,
            @ModelAttribute PageRequest pageRequest,
            @RequestParam Map<String, String> allParams) {

        Map<String, ChildPaginationParam> childParams = parseChildPaginationParams(allParams);
        Page<CompositeRecordResponse> page = compositeRecordService.getCompositeRecordsPage(id, pageRequest, childParams);

        String engine = (page.getContent() != null && !page.getContent().isEmpty())
                ? page.getContent().get(0).engineUsed()
                : "dynamic-sql-pushdown";

        ResponseEntity<ResponseWrapper<ContextHeader, Page<CompositeRecordResponse>>> entity = responseBuilder.success(page);
        return ResponseEntity.status(entity.getStatusCode())
                .header("X-Composite-Engine", engine)
                .body(entity.getBody());
    }

    @GetMapping("/{id}/records/{recordId}")
    @PreAuthorize("hasAuthority('METADATA_RECORD_READ') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, CompositeRecordResponse>> getCompositeRecord(
            @PathVariable("id") Long id,
            @PathVariable("recordId") Long recordId,
            @RequestParam Map<String, String> allParams) {

        Map<String, ChildPaginationParam> childParams = parseChildPaginationParams(allParams);
        CompositeRecordResponse record = compositeRecordService.getCompositeRecordById(id, recordId, childParams);

        ResponseEntity<ResponseWrapper<ContextHeader, CompositeRecordResponse>> entity = responseBuilder.success(record);
        return ResponseEntity.status(entity.getStatusCode())
                .header("X-Composite-Engine", record.engineUsed())
                .body(entity.getBody());
    }

    private Map<String, ChildPaginationParam> parseChildPaginationParams(Map<String, String> allParams) {
        if (allParams == null || allParams.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, Integer> limits = new HashMap<>();
        Map<String, Integer> offsets = new HashMap<>();

        for (Map.Entry<String, String> entry : allParams.entrySet()) {
            String key = entry.getKey();
            String val = entry.getValue();

            Matcher limitMatcher = CHILD_LIMIT_PATTERN.matcher(key);
            if (limitMatcher.matches()) {
                String alias = limitMatcher.group(1);
                try {
                    limits.put(alias, Integer.parseInt(val.trim()));
                } catch (Exception ignored) {}
                continue;
            }

            Matcher offsetMatcher = CHILD_OFFSET_PATTERN.matcher(key);
            if (offsetMatcher.matches()) {
                String alias = offsetMatcher.group(1);
                try {
                    offsets.put(alias, Integer.parseInt(val.trim()));
                } catch (Exception ignored) {}
            }
        }

        Set<String> allAliases = new HashSet<>();
        allAliases.addAll(limits.keySet());
        allAliases.addAll(offsets.keySet());

        Map<String, ChildPaginationParam> result = new HashMap<>();
        for (String alias : allAliases) {
            int limit = limits.getOrDefault(alias, ChildPaginationParam.DEFAULT_LIMIT);
            int offset = offsets.getOrDefault(alias, ChildPaginationParam.DEFAULT_OFFSET);
            result.put(alias, new ChildPaginationParam(limit, offset));
        }

        return result;
    }
}
