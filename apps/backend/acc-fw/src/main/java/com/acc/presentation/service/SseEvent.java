package com.acc.presentation.service;

import com.acc.core.io.Event;
import lombok.Builder;
import org.springframework.context.ApplicationEvent;

public class SseEvent extends ApplicationEvent{

  @Builder
	public SseEvent(Event source) {
		super(source);
	}

	private static final long serialVersionUID = 4780106968650310626L;

}
