package com.acc.core.io.processing;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MultithreadStrategy<I, C> implements ProcessingStrategy<I, C> {

	@Override
	public<P extends Processors<I, C>> void process(P processors, final I input, C context) {
		if (processors != null) {
			ExecutorService executor = Executors.newFixedThreadPool(5);
			for(final Processor<I, C> processor :processors.getProcessors()){
				executor.execute(new Runnable() {
					@Override
					public void run() {
						processor.process(input, context);
					}
				});
			}
			executor.shutdown();
		}
	}
}
