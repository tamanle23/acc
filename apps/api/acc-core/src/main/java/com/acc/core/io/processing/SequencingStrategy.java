package com.acc.core.io.processing;

public class SequencingStrategy<I, C> implements ProcessingStrategy<I, C> {

	@Override
	public<P extends Processors<I, C>> void process(P processors, I input, C context) {
		if(processors !=null){
			for(Processor<I, C> processor :processors.getProcessors()){
				processor.process(input, context);
			}
		}
	}
}
