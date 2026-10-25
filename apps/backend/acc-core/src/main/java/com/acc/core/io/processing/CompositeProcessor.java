package com.acc.core.io.processing;

import java.util.ArrayList;
import java.util.List;

public class CompositeProcessor<I, C> implements Processors<I, C>, Processor<I, C> {

	List<Processor<I, C>> processors = new ArrayList<>();

	ProcessingStrategy<I, C> processingStrategy;

	public CompositeProcessor(ProcessingStrategy<I, C> processingStrategy){
		this.processingStrategy = processingStrategy;
	}

	public void process(I input, C context) {
		if(processingStrategy!=null){
			processingStrategy.process(this,input, context);
		}
	}

	public synchronized <P extends Processor<I, C>>void add(P processor){
		if(processor !=null){
			this.processors.add(processor);
		}
	}

	public synchronized <P extends Processor<I, C>>void remove(P processor) {
		if(processors.contains(processor)){
			processors.remove(processor);
		}
	}

	public List<Processor<I, C>> getProcessors() {
		return processors;
	}
}
