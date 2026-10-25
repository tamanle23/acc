package com.acc.service;

import com.acc.core.io.Page;
import com.acc.core.io.PageRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Supplier;

@Component
public class PageBuilder {

  public <T> Page<T> build(PageRequest pageRequest, Supplier<Long> totalSupplier, Supplier<List<T>> contentSupplier) {
    Long total = null;
    if (totalSupplier != null) {
      total = totalSupplier.get();
    }
    List<T> content = contentSupplier != null ? contentSupplier.get() : List.of();
    Page<T> page = Page.<T>builder()
                      .totalElements(total)
                      .content(content)
                      .build();
    page.setNumber(pageRequest != null ? pageRequest.getNumber() : 1);
    int size = (pageRequest != null && pageRequest.getSize() > 0) ? pageRequest.getSize() : 10;
    page.setSize(size);
    if (total != null) {
      page.setTotalPages(total == 0L ? 0L : (total + size - 1) / size);
    }
    long offset = (pageRequest != null && pageRequest.getOffset() != null) ? pageRequest.getOffset() : 0L;
    page.setLastOffset(offset + (content != null ? content.size() : 0) - 1);
    return page;
  }
}
