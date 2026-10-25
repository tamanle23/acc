package com.acc.fs.model;

import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;

import jakarta.persistence.AttributeConverter;

@Component
public class FileConnectorConverter implements AttributeConverter<FileConnector, String>{

  Map<Integer, FileConnector> PREDEFINED_CONNECTORS = new HashMap<>();

  public FileConnectorConverter() {
    Field[] declaredFields = FileConnector.class.getDeclaredFields();
    for (Field field : declaredFields) {
      if (java.lang.reflect.Modifier.isStatic(field.getModifiers())
          && field.getDeclaringClass()==FileConnector.class) {
        FileConnector connector;
        try {
          field.setAccessible(true);
          connector = (FileConnector) field.get(null);
          PREDEFINED_CONNECTORS.put(connector.getValue(), connector);
        } catch (IllegalArgumentException | IllegalAccessException e) {
        }
      }
    }
  }

  @Override
  public String convertToDatabaseColumn(FileConnector attribute) {
    if(attribute!=null) {
      return String.format("%s:%s", attribute.getValue(), attribute.getName());
    }
    return "";
  }

  @Override
  public FileConnector convertToEntityAttribute(String dbData) {
    if(dbData!=null && dbData.indexOf(":")>=0) {
      String[] data = dbData.split(":");
      Integer val = Integer.valueOf(data[0]);
      if(PREDEFINED_CONNECTORS.containsKey(val)) {
        return PREDEFINED_CONNECTORS.get(val);
      }
      return new FileConnector(Integer.valueOf(data[0]), data[1]);
    }
    return null;
  }

}
