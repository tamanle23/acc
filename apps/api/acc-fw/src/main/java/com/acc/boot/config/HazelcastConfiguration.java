package com.acc.boot.config;

import com.hazelcast.config.Config;
import com.hazelcast.config.EvictionConfig;
import com.hazelcast.config.EvictionPolicy;
import com.hazelcast.config.InMemoryFormat;
import com.hazelcast.config.MapConfig;
import com.hazelcast.config.MaxSizePolicy;
import com.hazelcast.config.NearCacheConfig;
import com.hazelcast.core.Hazelcast;
import com.hazelcast.core.HazelcastInstance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

import java.util.Arrays;

@Configuration
public class HazelcastConfiguration {

  private static final Logger log = LoggerFactory.getLogger(HazelcastConfiguration.class);
  public static final String METADATA_SCHEMAS_MAP = "metadata-schemas";

  private final Environment environment;

  public HazelcastConfiguration(Environment environment) {
    this.environment = environment;
  }

  @Bean
  public Config hazelcastConfig() {
    Config config = new Config();
    String clusterName = environment.getProperty("hazelcast.cluster-name", "acc-cluster");
    config.setClusterName(clusterName);
    config.setInstanceName("acc-embedded-hazelcast");

    boolean isProd = Arrays.asList(environment.getActiveProfiles()).contains("prod");
    boolean clusterExplicitlyEnabled = Boolean.parseBoolean(environment.getProperty("hazelcast.cluster.enabled", "false"));

    if (isProd || clusterExplicitlyEnabled) {
      log.info("Configuring Hazelcast for clustered discovery (profile=prod or cluster.enabled=true)...");
      configureClusteredNetworking(config);
    } else {
      log.info("Configuring Hazelcast for local standalone mode (loopback 127.0.0.1, multicast disabled)...");
      configureLocalStandaloneNetworking(config);
    }

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

  private void configureLocalStandaloneNetworking(Config config) {
    config.getNetworkConfig().getJoin().getMulticastConfig().setEnabled(false);
    config.getNetworkConfig().getJoin().getTcpIpConfig().setEnabled(false);
    config.getNetworkConfig().getJoin().getAutoDetectionConfig().setEnabled(false);
    config.getNetworkConfig().getInterfaces().setEnabled(true).addInterface("127.0.0.1");
    config.setProperty("hazelcast.socket.bind.any", "false");
  }

  private void configureClusteredNetworking(Config config) {
    // Disable multicast in production clouds/containers (avoids UDP broadcast/multicast issues)
    config.getNetworkConfig().getJoin().getMulticastConfig().setEnabled(false);

    String k8sServiceName = environment.getProperty("hazelcast.k8s.service-name");
    String membersProperty = environment.getProperty("hazelcast.members");

    if (StringUtils.hasText(k8sServiceName)) {
      // Kubernetes Discovery
      log.info("Hazelcast: Enabling Kubernetes Discovery for service: {}", k8sServiceName);
      config.getNetworkConfig().getJoin().getKubernetesConfig()
          .setEnabled(true)
          .setProperty("service-name", k8sServiceName);
      String k8sNamespace = environment.getProperty("hazelcast.k8s.namespace");
      if (StringUtils.hasText(k8sNamespace)) {
        config.getNetworkConfig().getJoin().getKubernetesConfig().setProperty("namespace", k8sNamespace);
      }
    } else if (StringUtils.hasText(membersProperty)) {
      // Static TCP-IP Discovery
      log.info("Hazelcast: Enabling TCP-IP Discovery with members: {}", membersProperty);
      config.getNetworkConfig().getJoin().getTcpIpConfig().setEnabled(true);
      for (String member : membersProperty.split(",")) {
        String trimmed = member.trim();
        if (StringUtils.hasText(trimmed)) {
          config.getNetworkConfig().getJoin().getTcpIpConfig().addMember(trimmed);
        }
      }
    } else {
      // Production fallback: Enable auto-detection or TCP-IP on localhost
      log.warn("Hazelcast: In production profile but neither 'hazelcast.k8s.service-name' nor 'hazelcast.members' is configured. Enabling auto-detection.");
      config.getNetworkConfig().getJoin().getAutoDetectionConfig().setEnabled(true);
    }

    // Allow binding to container/host interface in production
    config.setProperty("hazelcast.socket.bind.any", "true");
  }

  @Bean
  public HazelcastInstance hazelcastInstance(Config hazelcastConfig) {
    return Hazelcast.getOrCreateHazelcastInstance(hazelcastConfig);
  }
}
