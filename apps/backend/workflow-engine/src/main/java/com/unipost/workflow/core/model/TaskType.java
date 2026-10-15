package com.unipost.workflow.core.model;

public enum TaskType {
    SIMPLE,
    SWITCH,
    FORK_JOIN,
    DYNAMIC_FORK,
    WAIT,
    DO_WHILE,
    SET_VARIABLE,
    JSON_JQ_TRANSFORM,
    INLINE,
    HTTP,
    HUMAN,
    JOIN,
    EXCLUSIVE_JOIN
}
