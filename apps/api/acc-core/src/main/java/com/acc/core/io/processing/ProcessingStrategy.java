package com.acc.core.io.processing;

public interface ProcessingStrategy<I, C> {
	public<P extends Processors<I, C>> void process(P processors,I input, C context);
}
