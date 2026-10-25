package com.acc.cache.redis;

import java.io.Closeable;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.acc.cache.exchange.Transformer;
import com.acc.core.exception.BusinessException;

import io.reactivex.rxjava3.core.BackpressureStrategy;
import io.reactivex.rxjava3.core.Flowable;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPool;
import redis.clients.jedis.ScanParams;
import redis.clients.jedis.ScanResult;
import redis.clients.jedis.params.SetParams;


public abstract class JedisBaseRepository<T> implements RedisRepository<T>, Closeable {

  protected final Logger logger = LoggerFactory.getLogger(this.getClass());
  static final String KEY_PATTERN = "%s:%s:%s";
  static final String KEY_SEPARATOR = ":";
  private static final Charset DEFAULT_CHARSET = StandardCharsets.UTF_8;

  Map<String, Transformer<T>> transformersMap = null;
  JedisPool jedisPool;

  protected abstract String getType();

  protected abstract Function<T,String> keyFactory();

  protected abstract List<Transformer<T>> getTransformers();

  private Map<String, Transformer<T>> getTransformerMap() {
    if(transformersMap != null) {
      return transformersMap;
    }
    transformersMap = new HashMap<>();
    for(Transformer<T> transformer: this.getTransformers()) {
      transformersMap.put(transformer.getId(), transformer);
    }
    return transformersMap;
  }

  public JedisBaseRepository(JedisPool jedisPool) {
    this.jedisPool = jedisPool;
  }

  public void save(T obj) {
    this.save(obj, null);
  }

  public void save(T obj, Long millisecondsToExpire) {
    Transformer<T> transformer = Optional.ofNullable(getTransformers()).orElseThrow(() -> new BusinessException("No transformer found.")).get(0);
    String result = null;
    String key = String.format(KEY_PATTERN, this.getType(), keyFactory().apply(obj), transformer.getId());
    if(obj != null) {
      SetParams setParams = new SetParams();
      if(millisecondsToExpire != null) {
        setParams.px(millisecondsToExpire);
      }

      try (Jedis jedis = jedisPool.getResource()) {
        result = jedis.set(key.getBytes(DEFAULT_CHARSET)
                            , transformer.encode(obj)
                            , setParams);
      }
    }
    logger.info("Result {}", result);
  }

  public Stream<T> findAll() {
    return Flowable.<T>create(emitter -> {
                        try (Jedis jedis = jedisPool.getResource()) {
                          ScanParams scanParams = new ScanParams().count(100).match(this.getTypeMatch());
                          String cur = ScanParams.SCAN_POINTER_START;
                          while(true) {
                            ScanResult<byte[]> scanResult =  jedis.scan(cur.getBytes(), scanParams);
                            scanResult.getResult()
                                      .forEach(k -> {
                                        Transformer<T> transformer = this.getTransformerMap().get(new String(k).split(KEY_SEPARATOR)[2]);
                                        byte[] value = jedis.get(k);
                                        if(value!=null) {
                                          emitter.onNext(transformer.decode(value));
                                        }
                                      });
                            cur = scanResult.getCursor();
                            if ("0".equals(cur)) {
                              break;
                            }
                          }
                        } catch(Exception ex) {
                          emitter.onError(ex);
                        } finally {
                          emitter.onComplete();
                        }
                      }, BackpressureStrategy.BUFFER)
            .blockingStream()
    ;
  }

  private String getTypeMatch() {
    return this.getType()+":*";
  }
  public Stream<T> findAllByIdIn(List<String> keys) {
    return Flowable.<T>create(emitter -> {
                try (Jedis jedis = jedisPool.getResource()) {
                  Optional.ofNullable(keys)
                          .filter(Objects::nonNull)
                          .map(List::stream)
                          .orElse(Stream.empty())
                          .map(k -> String.format(KEY_PATTERN, k , ""))
                          .forEach(field -> {
                            jedis.hget(this.getType(), field);
                          })
                          ;

                  ScanParams scanParams = new ScanParams().count(1).match(this.getType());
                  String cur = ScanParams.SCAN_POINTER_START;
                  while(true) {
                    ScanResult<Entry<byte[], byte[]>> scanResult =  jedis.hscan(this.getType().getBytes(), cur.getBytes(), scanParams);
                    scanResult.getResult().forEach(e -> {
                      emitter.onNext(this.getTransformerMap().get(new String(e.getKey()).split(".")[1]).decode(e.getValue()));
                    });
                    cur = scanResult.getCursor();
                    if ("0".equals(cur)) {
                      break;
                    }
                  }
                } catch(Exception ex) {
                  emitter.onError(ex);
                } finally {
                  emitter.onComplete();
                }
              }, BackpressureStrategy.BUFFER)
          .blockingStream()
          ;
  }

  public T findOne(Long id) {
    return null;
  }

  public Integer deleteByIdNotIn(List<Long> ids, LocalDateTime date) {
    return null;
  }

  public Integer deleteByIdIn(List<Long> ids) {
    return null;
  }

  public Integer deleteByUidIn(List<String> uids) {
    return null;
  }

  public void deleteById(Long id) {
  }

  @Override
  public void close() throws IOException {
    if(jedisPool != null) {
      jedisPool.close();
    }

  }

}
