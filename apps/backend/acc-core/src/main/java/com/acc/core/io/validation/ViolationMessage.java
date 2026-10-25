package com.acc.core.io.validation;

public interface ViolationMessage {
  
  static ViolationMessage of(String messageKey, String defaultMessageFormat) {
    return new BaseViolationMessage(messageKey, defaultMessageFormat);
  }
  
  static class BaseViolationMessage implements ViolationMessage {
    
    String defaultMessageFormat;
    String messageKey;
    private BaseViolationMessage(String messageKey, String defaultMessageFormat) {
      this.defaultMessageFormat = defaultMessageFormat;
      this.messageKey = messageKey;
    }

    @Override
    public String defaultMessageFormat() {
      return defaultMessageFormat;
    }

    @Override
    public String messageKey() {
      return messageKey;
    }
  }
  
  String defaultMessageFormat();

  String messageKey();

  enum Default implements ViolationMessage {
    OBJECT_NOT_NULL("object.notNull", "\"{0}\" must not be null"),
    STRING_NOT_EMPTY("string.notEmpty", "\"{0}\" must not be empty"),
    OBJECT_IS_NULL("object.isNull", "\"{0}\" must be null"),
    CONTAINER_NOT_EMPTY("container.notEmpty", "\"{0}\" must not be empty"),
    CONTAINER_LESS_THAN("container.lessThan", "The size of \"{0}\" must be less than {1}. The given size is {2}"),
    CONTAINER_LESS_THAN_OR_EQUAL("container.lessThanOrEqual",
        "The size of \"{0}\" must be less than or equal to {1}. The given size is {2}"),
    CONTAINER_GREATER_THAN("container.greaterThan",
        "The size of \"{0}\" must be greater than {1}. The given size is {2}"),
    CONTAINER_GREATER_THAN_OR_EQUAL("container.greaterThanOrEqual",
        "The size of \"{0}\" must be greater than or equal to {1}. The given size is {2}"),
    CONTAINER_FIXED_SIZE("container.fixedSize", "The size of \"{0}\" must be {1}. The given size is {2}"),
    COMPARABLE_GREATER_THAN("comparable.greaterThan", "\"{0}\" must be greater than {1}"),
    COMPARABLE_GREATER_THAN_OR_EQUAL("comparable.greaterThanOrEqual", "\"{0}\" must be greater than or equal to {1}"),
    COMPARABLE_LESS_THAN("comparable.lessThan", "\"{0}\" must be less than {1}"),
    COMPARABLE_LESS_THAN_OR_EQUAL("comparable.lessThanOrEqual", "\"{0}\" must be less than or equal to {1}"),
    
    NUMERIC_GREATER_THAN("numeric.greaterThan", "\"{0}\" must be greater than {1}"),
    NUMERIC_GREATER_THAN_OR_EQUAL("numeric.greaterThanOrEqual", "\"{0}\" must be greater than or equal to {1}"),
    NUMERIC_LESS_THAN("numeric.lessThan", "\"{0}\" must be less than {1}"),
    NUMERIC_LESS_THAN_OR_EQUAL("numeric.lessThanOrEqual", "\"{0}\" must be less than or equal to {1}"),
    
    BOOLEAN_IS_TRUE("boolean.isTrue", "\"{0}\" must be true"),
    BOOLEAN_IS_FALSE("boolean.isFalse", "\"{0}\" must be false"),
    CHAR_SEQUENCE_NOT_BLANK("charSequence.notBlank", "\"{0}\" must not be blank"),
    CHAR_SEQUENCE_CONTAINS("charSequence.contains", "\"{0}\" must contain {1}"),
    CHAR_SEQUENCE_EMAIL("charSequence.email", "\"{0}\" must be a valid email address"),
    CHAR_SEQUENCE_URL("charSequence.url", "\"{0}\" must be a valid URL"),
    CHAR_SEQUENCE_PATTERN("charSequence.pattern", "\"{0}\" must match {1}"),
    BYTE_SIZE_LESS_THAN("byteSize.lessThan", "The size of \"{0}\" must be less than {1}. The given size is {2}"),
    BYTE_SIZE_LESS_THAN_OR_EQUAL("byteSize.lessThanOrEqual",
        "The byte size of \"{0}\" must be less than or equal to {1}. The given size is {2}"),
    BYTE_SIZE_GREATER_THAN("byteSize.greaterThan",
        "The byte size of \"{0}\" must be greater than {1}. The given size is {2}"),
    BYTE_SIZE_GREATER_THAN_OR_EQUAL("byteSize.greaterThanOrEqual",
        "The byte size of \"{0}\" must be greater than or equal to {1}. The given size is {2}"),
    BYTE_SIZE_FIXED_SIZE("byteSize.fixedSize", "The byte size of \"{0}\" must be {1}. The given size is {2}"),
    COLLECTION_CONTAINS("collection.contains", "\"{0}\" must contain {1}"),
    MAP_CONTAINS_VALUE("map.containsValue", "\"{0}\" must contain value {1}"),
    MAP_CONTAINS_KEY("map.containsKey", "\"{0}\" must contain key {1}"),
    ARRAY_CONTAINS("array.contains", "\"{0}\" must contain {1}"),
    CODE_POINTS_ALL_INCLUDED("codePoints.asWhiteList", "\"{1}\" is/are not allowed for \"{0}\""),
    CODE_POINTS_NOT_INCLUDED("codePoints.asBlackList", "\"{1}\" is/are not allowed for \"{0}\"");

    private final String defaultMessageFormat;

    private final String messageKey;

    Default(String messageKey, String defaultMessageFormat) {
      this.messageKey = messageKey;
      this.defaultMessageFormat = defaultMessageFormat;
    }

    @Override
    public String defaultMessageFormat() {
      return this.defaultMessageFormat;
    }

    @Override
    public String messageKey() {
      return this.messageKey;
    }
  }
}
