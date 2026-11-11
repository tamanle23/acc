package com.acc.fw.mediator;

import com.acc.core.mediator.Command;
import com.acc.core.mediator.CommandDispatcher;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.ResolvableType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Dynamic ResolvableType-safe command dispatcher for heterogeneous CQRS commands
 * and dynamic JSONB attributes deserialization.
 */
@Component
public class DynamicCommandDispatcher {

    private final CommandDispatcher commandDispatcher;
    private final ObjectMapper objectMapper;

    public DynamicCommandDispatcher(CommandDispatcher commandDispatcher, ObjectMapper objectMapper) {
        this.commandDispatcher = commandDispatcher;
        this.objectMapper = objectMapper;
    }

    @SuppressWarnings("unchecked")
    public <R, C extends Command<R>> R dispatchPayload(Class<C> commandClass, Map<String, Object> payload) {
        if (commandClass == null) {
            throw new IllegalArgumentException("commandClass must not be null");
        }

        ResolvableType commandResolvableType = ResolvableType.forClass(commandClass).as(Command.class);
        if (!commandResolvableType.isAssignableFrom(ResolvableType.forClass(commandClass)) 
                && !Command.class.isAssignableFrom(commandClass)) {
            throw new IllegalArgumentException("Target class " + commandClass.getName() + " is not an instance of Command");
        }

        C commandInstance;
        if (payload == null || payload.isEmpty()) {
            try {
                commandInstance = commandClass.getDeclaredConstructor().newInstance();
            } catch (Exception e) {
                commandInstance = objectMapper.convertValue(Map.of(), commandClass);
            }
        } else {
            commandInstance = objectMapper.convertValue(payload, commandClass);
        }

        return commandDispatcher.dispatch(commandInstance);
    }

    public <R, C extends Command<R>> R dispatch(C command) {
        if (command == null) {
            throw new IllegalArgumentException("command must not be null");
        }
        return commandDispatcher.dispatch(command);
    }
}
