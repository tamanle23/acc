package com.acc.fw.context;

import com.acc.core.context.Context;
import com.acc.core.io.ContextHeader;
import com.acc.fw.tenancy.TenantContextHolder;
import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Map;

/**
 * Task decorator that propagates tenant identity, security context, MDC logs,
 * and application Context across asynchronous execution boundaries (@Async and pooled executors).
 */
public class AsyncContextTaskDecorator implements TaskDecorator {

  private final Context context;

  public AsyncContextTaskDecorator(Context contextHelper) {
    this.context = contextHelper;
  }

  @Override
  public Runnable decorate(Runnable runnable) {
    // Snapshot calling thread's contexts
    ContextHeader currentContext = context != null ? context.getHeader() : null;
    String tenantId = TenantContextHolder.getTenantId();
    SecurityContext securityContext = SecurityContextHolder.getContext();
    Map<String, String> mdcContext = MDC.getCopyOfContextMap();

    return () -> {
      try {
        // Restore onto worker thread
        if (context != null && currentContext != null) {
          context.setRequestHeader(currentContext);
        }
        if (tenantId != null) {
          TenantContextHolder.setTenantId(tenantId);
        }
        if (securityContext != null) {
          SecurityContextHolder.setContext(securityContext);
        }
        if (mdcContext != null) {
          MDC.setContextMap(mdcContext);
        }

        runnable.run();
      } finally {
        // Guarantee clean wipe of worker thread to prevent cross-tenant pool leakage
        TenantContextHolder.clear();
        SecurityContextHolder.clearContext();
        MDC.clear();
        if (context != null) {
          context.clear();
        }
      }
    };
  }
}
