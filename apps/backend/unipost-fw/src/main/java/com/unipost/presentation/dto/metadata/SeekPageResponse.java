package com.unipost.presentation.dto.metadata;

import java.util.List;

public record SeekPageResponse<T>(
    List<T> items,
    String nextCursor,
    boolean hasMore,
    int pageSize
) {}
