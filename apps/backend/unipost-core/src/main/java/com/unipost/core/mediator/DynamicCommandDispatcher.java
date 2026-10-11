package com.unipost.core.mediator;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.ResolvableType;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Dynamic ResolvableType-safe command dispatcher for heterogeneous CQRS commands
 * and dynamic JSONB attributes deserialization.
 *
 * Prevents raw Java reflection issues over CGLIB proxy classes created by Spring @Transactional
 * or @PreAuthorize aspects.
 */
@Component
public class DynamicCommandDispatcher {

    private final CommandDispatcher commandDispatcher;
    private final ObjectMapper objectMapper;

    public DynamicCommandDispatcher(CommandDispatcher commandDispatcher, ObjectMapper objectMapper) {
        this.commandDispatcher = commandDispatcher;
        this.objectMapper = objectMapper;
    }

    /**
     * Dynamically deserializes a payload into a strongly-typed Command and dispatches it
     * via the underlying ResolvableType-based CommandDispatcher.
     *
     * @param commandClass the target command class
     * @param payload      heterogeneous map/JSONB attributes
     * @param <R>          expected return type
     * @param <C>          concrete command type
     * @return dispatch result
     */
    @SuppressWarnings("unchecked")
    public <R, C extends Command<R>> R dispatchPayload(Class<C> commandClass, Map<String, Object> payload) {
        if (commandClass == null) {
            throw new IllegalArgumentException("commandClass must not be null");
        }

        // Validate via Spring ResolvableType that commandClass implements Command<R>
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

    /**
     * Direct dispatch using generic ResolvableType safety.
     */
    public <R, C extends Command<R>> R dispatch(C command) {
        if (command == null) {
            throw new IllegalArgumentException("command must not be null");
        }
        return commandDispatcher.dispatch(command);
    }
}
