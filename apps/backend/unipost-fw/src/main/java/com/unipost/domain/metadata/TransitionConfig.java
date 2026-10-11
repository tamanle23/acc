package com.unipost.domain.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;
import java.util.List;

public record TransitionConfig(
    @JsonProperty("from")
    String from,

    @JsonProperty("to")
    String to,

    @JsonProperty("action")
    String action,

    @JsonProperty("required_attributes")
    List<String> requiredAttributes,

    @JsonProperty("guard_expression")
    String guardExpression,

    @JsonProperty("allowed_roles")
    List<String> allowedRoles
) implements Serializable {}
