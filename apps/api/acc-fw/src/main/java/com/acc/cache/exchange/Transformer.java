package com.acc.cache.exchange;

public interface Transformer<T> {
  
  String getId();
  byte[] encode(T object);
  T decode(byte[] bytes);
}
