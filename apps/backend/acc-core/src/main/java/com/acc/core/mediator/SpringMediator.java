package com.acc.core.mediator;

import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import org.springframework.util.ClassUtils;
import org.springframework.core.ResolvableType;

import jakarta.annotation.PostConstruct;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SpringMediator implements CommandDispatcher, QueryDispatcher {

    private final ApplicationContext applicationContext;
    private final Map<Class<?>, CommandHandler<?, ?>> commandHandlers = new ConcurrentHashMap<>();
    private final Map<Class<?>, QueryHandler<?, ?>> queryHandlers = new ConcurrentHashMap<>();

    public SpringMediator(ApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    @PostConstruct
    public void init() {
        // Cache Command Handlers
        String[] commandHandlerNames = applicationContext.getBeanNamesForType(CommandHandler.class);
        for (String beanName : commandHandlerNames) {
            CommandHandler<?, ?> handler = applicationContext.getBean(beanName, CommandHandler.class);
            Class<?> targetClass = ClassUtils.getUserClass(handler);
            ResolvableType resolvableType = ResolvableType.forClass(targetClass).as(CommandHandler.class);
            if (resolvableType.hasGenerics()) {
                Class<?> commandType = resolvableType.resolveGeneric(0);
                commandHandlers.put(commandType, handler);
            }
        }

        // Cache Query Handlers
        String[] queryHandlerNames = applicationContext.getBeanNamesForType(QueryHandler.class);
        for (String beanName : queryHandlerNames) {
            QueryHandler<?, ?> handler = applicationContext.getBean(beanName, QueryHandler.class);
            Class<?> targetClass = ClassUtils.getUserClass(handler);
            ResolvableType resolvableType = ResolvableType.forClass(targetClass).as(QueryHandler.class);
            if (resolvableType.hasGenerics()) {
                Class<?> queryType = resolvableType.resolveGeneric(0);
                queryHandlers.put(queryType, handler);
            }
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public <R, C extends Command<R>> R dispatch(C command) {
        CommandHandler<C, R> handler = (CommandHandler<C, R>) commandHandlers.get(command.getClass());
        if (handler != null) {
            return handler.handle(command);
        }
        throw new IllegalArgumentException("No handler found for command: " + command.getClass().getName());
    }

    @Override
    @SuppressWarnings("unchecked")
    public <R, Q extends Query<R>> R dispatch(Q query) {
        QueryHandler<Q, R> handler = (QueryHandler<Q, R>) queryHandlers.get(query.getClass());
        if (handler != null) {
            return handler.handle(query);
        }
        throw new IllegalArgumentException("No handler found for query: " + query.getClass().getName());
    }
}
