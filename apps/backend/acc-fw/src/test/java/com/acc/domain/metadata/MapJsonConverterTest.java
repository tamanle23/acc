package com.acc.domain.metadata;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import java.lang.reflect.Field;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class MapJsonConverterTest {

    private ObjectMapper objectMapper;
    private MapJsonConverter mapJsonConverter;

    @BeforeEach
    void setUp() throws Exception {
        objectMapper = new ObjectMapper();

        // Since reflection in the superclass constructor fails without a proper subclass,
        // and setting it via Spring's ReflectionTestUtils is failing due to 'documentTypeClass'
        // not being resolvable on the anonymous proxy, we can directly create the base instance
        // using unsafe reflection to bypass the constructor entirely if needed, or better yet,
        // use a real named subclass that fulfills the generic requirements:

        class RealMapJsonConverter extends MapJsonConverter {
            public RealMapJsonConverter(ObjectMapper objectMapper) {
                super(objectMapper);
            }
        }

        mapJsonConverter = new RealMapJsonConverter(objectMapper);
    }

    @Test
    void testConvertToDatabaseColumn() {
        Map<String, Object> map = new HashMap<>();
        map.put("key", "value");

        String json = mapJsonConverter.convertToDatabaseColumn(map);

        assertNotNull(json);
        assertEquals("{\"key\":\"value\"}", json);
    }

    @Test
    void testConvertToEntityAttribute() {
        String json = "{\"key\":\"value\"}";

        Map<String, Object> map = mapJsonConverter.convertToEntityAttribute(json);

        assertNotNull(map);
        assertEquals("value", map.get("key"));
    }
}
