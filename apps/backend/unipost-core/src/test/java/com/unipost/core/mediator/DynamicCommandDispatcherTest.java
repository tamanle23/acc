package com.unipost.core.mediator;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.StaticApplicationContext;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DynamicCommandDispatcherTest {

    private SpringMediator springMediator;
    private DynamicCommandDispatcher dynamicCommandDispatcher;
    private ObjectMapper objectMapper;

    // Test Command and Handler
    public record CreateArticleCommand(String title, String content, int views) implements Command<String> {
        public CreateArticleCommand() {
            this("", "", 0);
        }
    }

    public static class CreateArticleCommandHandler implements CommandHandler<CreateArticleCommand, String> {
        @Override
        public String handle(CreateArticleCommand command) {
            return "ArticleCreated:" + command.title() + ":" + command.views();
        }
    }

    @BeforeEach
    void setUp() {
        StaticApplicationContext context = new StaticApplicationContext();
        context.registerSingleton("createArticleCommandHandler", CreateArticleCommandHandler.class);
        context.refresh();

        springMediator = new SpringMediator(context);
        springMediator.init();

        objectMapper = new ObjectMapper();
        dynamicCommandDispatcher = new DynamicCommandDispatcher(springMediator, objectMapper);
    }

    @Test
    void testDirectDispatchWithResolvableTypeHandler() {
        CreateArticleCommand command = new CreateArticleCommand("Hello World", "Content body", 42);
        String result = dynamicCommandDispatcher.dispatch(command);

        assertEquals("ArticleCreated:Hello World:42", result);
    }

    @Test
    void testDynamicPayloadDispatchWithJsonbDeserialization() {
        Map<String, Object> payload = Map.of(
                "title", "Dynamic Title",
                "content", "Dynamic Content",
                "views", 100
        );

        String result = dynamicCommandDispatcher.dispatchPayload(CreateArticleCommand.class, payload);

        assertEquals("ArticleCreated:Dynamic Title:100", result);
    }

    @Test
    void testNullCommandOrClassThrowsIllegalArgumentException() {
        assertThrows(IllegalArgumentException.class, () -> dynamicCommandDispatcher.dispatch(null));
        assertThrows(IllegalArgumentException.class, () -> dynamicCommandDispatcher.dispatchPayload(null, Map.of()));
    }
}
