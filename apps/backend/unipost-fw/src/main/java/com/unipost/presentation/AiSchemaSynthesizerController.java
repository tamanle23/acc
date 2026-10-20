package com.unipost.presentation;

import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.service.metadata.AiSchemaSynthesizerService;
import com.unipost.service.metadata.AiSchemaSynthesizerService.SynthesizeSchemaRequest;
import com.unipost.service.metadata.AiSchemaSynthesizerService.SynthesizedSchemaBlueprint;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/metadata/ai")
@RequiredArgsConstructor
public class AiSchemaSynthesizerController {

    private final AiSchemaSynthesizerService synthesizerService;
    private final ResponseEntityBuilder responseBuilder;

    @PostMapping("/synthesize-schema")
    @PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasAuthority('METADATA_SCHEMA_READ') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, SynthesizedSchemaBlueprint>> synthesizeSchema(
            @RequestBody SynthesizeSchemaRequest request
    ) {
        SynthesizedSchemaBlueprint blueprint = synthesizerService.synthesize(request);
        return responseBuilder.success(blueprint);
    }
}
