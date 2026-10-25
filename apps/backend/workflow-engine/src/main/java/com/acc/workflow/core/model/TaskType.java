package com.acc.workflow.core.model;

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
    EXCLUSIVE_JOIN,
    TERMINATE,
    SUB_WORKFLOW,
    START_WORKFLOW,
    EVENT,
    DYNAMIC,
    LLM_CHAT_COMPLETE,
    NOOP,
    JDBC,
    KAFKA_PUBLISH,
    CALL_MCP_TOOL
}
