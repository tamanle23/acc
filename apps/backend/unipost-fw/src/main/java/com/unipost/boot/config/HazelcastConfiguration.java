package com.unipost.boot.config;

import com.hazelcast.config.Config;
import com.hazelcast.config.EvictionConfig;
import com.hazelcast.config.EvictionPolicy;
import com.hazelcast.config.InMemoryFormat;
import com.hazelcast.config.MapConfig;
import com.hazelcast.config.MaxSizePolicy;
import com.hazelcast.config.NearCacheConfig;
import com.hazelcast.core.Hazelcast;
import com.hazelcast.core.HazelcastInstance;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class HazelcastConfiguration {

  public static final String METADATA_SCHEMAS_MAP = "metadata-schemas";

  @Bean
  public Config hazelcastConfig() {
    Config config = new Config();
    config.setClusterName("unipost-cluster");
    config.setInstanceName("unipost-embedded-hazelcast");

    // Use loopback/local discovery for dev/embedded clustering to avoid Windows setsockopt multicast issues
    config.getNetworkConfig().getJoin().getMulticastConfig().setEnabled(false);
    config.getNetworkConfig().getJoin().getTcpIpConfig().setEnabled(false);
    config.getNetworkConfig().getJoin().getAutoDetectionConfig().setEnabled(false);
    config.getNetworkConfig().getInterfaces().setEnabled(true).addInterface("127.0.0.1");
    config.setProperty("hazelcast.socket.bind.any", "false");

    // Configure metadata schemas distributed map
    MapConfig metadataSchemasConfig = new MapConfig(METADATA_SCHEMAS_MAP);
    metadataSchemasConfig.setTimeToLiveSeconds(3600); // 1 hour TTL
    metadataSchemasConfig.setInMemoryFormat(InMemoryFormat.BINARY);

    EvictionConfig evictionConfig = new EvictionConfig();
    evictionConfig.setEvictionPolicy(EvictionPolicy.LRU);
    evictionConfig.setMaxSizePolicy(MaxSizePolicy.PER_NODE);
    evictionConfig.setSize(2000);
    metadataSchemasConfig.setEvictionConfig(evictionConfig);

    // Near cache configuration on local node for microsecond in-process access
    NearCacheConfig nearCacheConfig = new NearCacheConfig();
    nearCacheConfig.setName("metadata-schemas-near-cache");
    nearCacheConfig.setInMemoryFormat(InMemoryFormat.OBJECT);
    nearCacheConfig.setInvalidateOnChange(true);
    nearCacheConfig.setTimeToLiveSeconds(3600);
    metadataSchemasConfig.setNearCacheConfig(nearCacheConfig);

    config.addMapConfig(metadataSchemasConfig);
    return config;
  }

  @Bean
  public HazelcastInstance hazelcastInstance(Config hazelcastConfig) {
    return Hazelcast.getOrCreateHazelcastInstance(hazelcastConfig);
  }
}
