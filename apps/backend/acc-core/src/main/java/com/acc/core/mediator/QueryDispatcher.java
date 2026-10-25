package com.acc.core.mediator;

public interface QueryDispatcher {
    <R, Q extends Query<R>> R dispatch(Q query);
}
