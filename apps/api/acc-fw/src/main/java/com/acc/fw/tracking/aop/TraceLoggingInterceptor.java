package com.acc.fw.tracking.aop;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.MethodParameter;
import org.springframework.util.StringUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

public class TraceLoggingInterceptor implements HandlerInterceptor {
	private static final Logger logger = LoggerFactory.getLogger(TraceLoggingInterceptor.class);

	private static final String START_ATTR = TraceLoggingInterceptor.class.getName() + ".startTime";

	private static final String HANDLING_ATTR = TraceLoggingInterceptor.class.getName() + ".handlingTime";

	private static final long DEFAULT_WARN_NANOS = TimeUnit.SECONDS.toNanos(3L);
	private long warnHandlingNanos;

	public TraceLoggingInterceptor() {
		this.warnHandlingNanos = DEFAULT_WARN_NANOS;
	}

	public boolean preHandle(HttpServletRequest request,
			HttpServletResponse response, Object handler) {
		if (!(handler instanceof HandlerMethod)) {
			return true;
		}

		if (logger.isTraceEnabled()) {
			HandlerMethod handlerMethod = (HandlerMethod) handler;
			Method m = handlerMethod.getMethod();
			logger.trace("[START CONTROLLER] {}.{}({})", new Object[] {
					m.getDeclaringClass().getSimpleName(), m.getName(),
					buildMethodParams(handlerMethod) });
		}

		long startTime = System.nanoTime();
		request.setAttribute(START_ATTR, Long.valueOf(startTime));
		return true;
	}

	public void postHandle(HttpServletRequest request,
			HttpServletResponse response, Object handler,
			ModelAndView modelAndView) {
		if (!(handler instanceof HandlerMethod)) {
			return;
		}

		long startTime = 0L;
		if (request.getAttribute(START_ATTR) != null) {
			startTime = ((Long) request.getAttribute(START_ATTR)).longValue();
		}
		long handlingTime = System.nanoTime() - startTime;
		request.removeAttribute(START_ATTR);
		request.setAttribute(HANDLING_ATTR, Long.valueOf(handlingTime));
		String formattedHandlingTime = String.format("%1$,3d",new Object[] { Long.valueOf(handlingTime) });

		boolean isWarnHandling = handlingTime > this.warnHandlingNanos;

		if (isWarnHandling) {
			if (!(logger.isWarnEnabled()))
				return;
		} else if (!(logger.isTraceEnabled())) {
			return;
		}

		HandlerMethod handlerMethod = (HandlerMethod) handler;
		Method m = handlerMethod.getMethod();
		Object view = null;
		Map model = null;
		if (modelAndView != null) {
			view = modelAndView.getView();
			model = modelAndView.getModel();
			if (view == null) {
				view = modelAndView.getViewName();
			}
		}

		logger.trace("[END CONTROLLER  ] {}.{}({})-> view={}, model={}",
				new Object[] { m.getDeclaringClass().getSimpleName(),
						m.getName(), buildMethodParams(handlerMethod), view,
						model });

		String handlingTimeMessage = "[HANDLING TIME   ] {}.{}({})-> {} ns";
		if (isWarnHandling) {
			logger.warn(handlingTimeMessage + " > {}", 
					new Object[] {
								m.getDeclaringClass().getSimpleName(), m.getName(),
								buildMethodParams(handlerMethod), formattedHandlingTime,
								Long.valueOf(this.warnHandlingNanos) 
					});
		} else {
			logger.trace(handlingTimeMessage, 
					new Object[] {
									m.getDeclaringClass().getSimpleName(), m.getName(),
									buildMethodParams(handlerMethod), formattedHandlingTime
								});
		}
	}

	protected static String buildMethodParams(HandlerMethod handlerMethod) {
		MethodParameter[] params = handlerMethod.getMethodParameters();
		List<String> lst = new ArrayList<String>(params.length);
		for (MethodParameter p : params) {
			lst.add(p.getParameterType().getSimpleName());
		}
		return StringUtils.collectionToCommaDelimitedString(lst);
	}

	public void setWarnHandlingNanos(long warnHandlingNanos) {
		this.warnHandlingNanos = warnHandlingNanos;
	}
}