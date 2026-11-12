package com.acc.core.helper;

import java.io.IOException;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.util.DefaultPrettyPrinter;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.ObjectWriter;
import com.fasterxml.jackson.databind.SerializationFeature;

public class JsonHelper {
  
  public static final JsonHelper INSTANCE = new JsonHelper();
  
  ObjectMapper mapper;
  
  private JsonHelper() {
    JsonFactory json = new JsonFactory();
    mapper = new ObjectMapper(json);
  }
  
  public String toJson(Object obj){
    ObjectWriter writer = mapper.writer()
                                .with(new DefaultPrettyPrinter())
                                .without(SerializationFeature.FAIL_ON_EMPTY_BEANS)
                                .without(SerializationFeature.FAIL_ON_SELF_REFERENCES);
    try {
      return writer.writeValueAsString(obj);
    } catch (JsonProcessingException e) {
      return StringUtils.EMPTY;
    }
}

  public <T> T toObject(String objJson,final Class<T> clazz){
    if(objJson==null) return null;
    ObjectReader reader = mapper.reader()
                                .forType(clazz)
                                .without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    try {
      return reader.readValue(objJson);
    } catch (IOException e) {
      return null;
    }
  }
  
  public <T> T toObject(Map<String,Object> mapValue, Class<T> clazz) {
    return mapper.convertValue(mapValue, clazz);
  }
  
  public <T> Map<String,Object> toMap(T obj) {
    return mapper.convertValue(obj, Map.class);
  }
}
