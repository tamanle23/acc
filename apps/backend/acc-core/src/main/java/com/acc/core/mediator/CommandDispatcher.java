package com.acc.core.mediator;

public interface CommandDispatcher {
    <R, C extends Command<R>> R dispatch(C command);
}
