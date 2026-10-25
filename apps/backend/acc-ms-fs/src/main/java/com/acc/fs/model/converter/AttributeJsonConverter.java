package com.acc.fs.model.converter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.domain.JsonConverter;
import com.acc.fs.model.FileAttributes;
import org.springframework.stereotype.Component;

@Component
public class AttributeJsonConverter extends JsonConverter<FileAttributes> {
  public AttributeJsonConverter(ObjectMapper objectMapper) {
    super(objectMapper);
  }
}
