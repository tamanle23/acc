package com.acc.domain.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;
import java.util.List;

public record LifecycleConfig(
    @JsonProperty("state_field")
    String stateField,

    @JsonProperty("initial_state")
    String initialState,

    @JsonProperty("states")
    List<String> states,

    @JsonProperty("transitions")
    List<TransitionConfig> transitions
) implements Serializable {

    public String stateFieldOrDefault() {
        return (stateField != null && !stateField.isBlank()) ? stateField.trim() : "status";
    }

    public String initialStateOrDefault() {
        return (initialState != null && !initialState.isBlank()) ? initialState.trim() : "DRAFT";
    }
}
