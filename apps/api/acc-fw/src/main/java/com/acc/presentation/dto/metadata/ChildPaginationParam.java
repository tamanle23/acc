package com.acc.presentation.dto.metadata;

public record ChildPaginationParam(
        int limit,
        int offset
) {
    public static final int DEFAULT_LIMIT = 50;
    public static final int DEFAULT_OFFSET = 0;

    public ChildPaginationParam {
        if (limit <= 0) limit = DEFAULT_LIMIT;
        if (offset < 0) offset = DEFAULT_OFFSET;
    }

    public static ChildPaginationParam ofDefault() {
        return new ChildPaginationParam(DEFAULT_LIMIT, DEFAULT_OFFSET);
    }
}
