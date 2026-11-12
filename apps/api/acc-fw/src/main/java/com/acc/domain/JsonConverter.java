package com.acc.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.SneakyThrows;
import org.springframework.beans.factory.annotation.Autowired;

import jakarta.persistence.AttributeConverter;
import java.lang.reflect.ParameterizedType;


public abstract class JsonConverter<T> implements AttributeConverter<T, String> {

  private final Class<T> documentTypeClass;


  private ObjectMapper objectMapper;

  public JsonConverter(@Autowired ObjectMapper objectMapper) {
    this.documentTypeClass = ((Class<T>) ((ParameterizedType) this.getClass().getGenericSuperclass()).getActualTypeArguments()[0]);
    this.objectMapper = objectMapper;
  }

  @Override
  @SneakyThrows
  public String convertToDatabaseColumn(T attribute) {
    return objectMapper.writeValueAsString(attribute);
  }

  @SneakyThrows
  @Override
  public T convertToEntityAttribute(String dbData) {
    return objectMapper.readValue(dbData, documentTypeClass);
  }
}
